# Architecture V2: Discovery + Processing Pattern

## Overview

Split scraping into lightweight discovery (cheap) and heavy processing (expensive).

**Key Insight:** Discovery can always succeed because it only:
1. Fetches from static JSON files (awesome-for-beginners)
2. Makes 1 GitHub API call per repo (metadata only)
3. Writes to database

Processing handles expensive operations and can retry via queue.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  REPO DISCOVERY SERVICE                     │
│                  (scraper-service refactored)                │
│                  Cron: Every 12 hours                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌─────────┐      ┌─────────┐      ┌──────────┐
   │awesome- │      │GitHub   │      │ D1       │
   │for-     │      │Repo API │      │ Database │
   │beginners│      │(metadata│      │          │
   └─────────┘      │ only)   │      └──────────┘
                    └─────────┘
                           │
                           │ For each repo:
                           │ 1. Get open_issues_count
                           │ 2. Insert/update in DB
                           │ 3. Queue if new or changed
                           │
                           ▼
                 ┌──────────────────┐
                 │ processing-queue │
                 └────────┬─────────┘
                          │
              ┌───────────┴────────────┐
              │                        │
              ▼                        ▼
    { type: "process_repo",  { type: "process_issue",
      repoId: 123 }            issueId: 456 }
              │                        │
              └───────────┬────────────┘
                          │
                          ▼
         ┌────────────────────────────────┐
         │       DATA SERVICE             │
         │    (queue consumer)            │
         │                                │
         │  Handles both repo & issue     │
         │  processing based on type      │
         └────────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │                                 │
         ▼                                 ▼
┌─────────────────────┐         ┌──────────────────────┐
│  REPO PROCESSING    │         │  ISSUE PROCESSING    │
│                     │         │                      │
│ 1. Fetch from DB    │         │ 1. Fetch from DB     │
│ 2. Get languages    │         │ 2. Get full details  │
│    (GitHub API)     │         │    (GitHub API)      │
│ 3. Generate AI      │         │ 3. Generate AI       │
│    summary          │         │    analysis          │
│ 4. Fetch all issues │         │ 4. Update DB         │
│    (GitHub API)     │         │                      │
│ 5. Update/insert    │         └──────────────────────┘
│    issues in DB     │
│ 6. Queue changed    │
│    issues           │
└─────────────────────┘
```

## Service Responsibilities

### 1. Repo Discovery Service

**File:** `apps/scraper-service` (refactored)

**Triggers:** Cron (every 12 hours)

**Operations:**
1. Fetch repos from all data sources (awesome-for-beginners, etc.)
2. For each repo:
   - Call GitHub API: `GET /repos/{owner}/{name}` (get `open_issues_count`)
   - Check if repo exists in DB
   - Calculate metadata hash (owner, name, tag, source)
   - **Insert if new** OR **Update if hash/issue_count changed**
   - **Queue for processing** if new or changed

**Why it always succeeds:**
- Data source fetches are HTTP requests (not D1 subrequests)
- GitHub metadata calls: 1 per repo (~150 repos = 150 requests, well under limit)
- DB writes: 1-2 per repo (~300 subrequests, under 1000 limit on paid)
- **No continuation needed** - will complete in one run

**Queue messages sent:**
```typescript
{
  type: "process_repo",
  repoId: 123
}
```

### 2. Data Service - Repo Processing

**File:** `apps/data-service` (refactored)

**Triggers:** Queue consumer (`processing-queue`)

**Message type:** `{ type: "process_repo", repoId: number }`

**Operations:**
1. Fetch repo from DB by ID
2. Fetch languages from GitHub: `GET /repos/{owner}/{name}/languages`
3. Generate AI summary (Workers AI)
4. Update repo in DB (languages, AI summary, set `processingStatus = "completed"`, `processedAt = now()`)
5. Fetch all issues from GitHub: `GET /repos/{owner}/{name}/issues?label={tag}&state=open`
6. For each issue:
   - Calculate metadata hash (comment_count, state, assignees)
   - Check if exists in DB
   - **Insert if new** OR **Update if hash changed**
   - **Queue for processing** if new or changed

**Queue messages sent:**
```typescript
{
  type: "process_issue",
  issueId: 456
}
```

**Error handling:**
- If hits subrequest limit: Worker terminates, queue retries (fresh quota)
- If GitHub API fails: Log error, ack message (don't retry infinitely)
- If AI fails: Log error, mark as failed in DB

### 3. Data Service - Issue Processing

**File:** `apps/data-service` (same service, different handler)

**Triggers:** Queue consumer (`processing-queue`)

**Message type:** `{ type: "process_issue", issueId: number }`

**Operations:**
1. Fetch issue from DB by ID
2. Fetch full issue details from GitHub: `GET /repos/{owner}/{name}/issues/{number}`
   - Gets complete body text (may be truncated in list endpoint)
3. Generate AI analysis (Workers AI):
   - Issue introduction
   - Difficulty score
   - First steps
4. Update issue in DB (AI content, set `processingStatus = "completed"`, `processedAt = now()`)

**Error handling:**
- If hits subrequest limit: Worker terminates, queue retries (fresh quota)
- If GitHub API fails: Log error, mark as failed
- If AI fails: Log error, mark as failed

## Database Schema Changes

### Repos Table

**Added column:**
```typescript
openIssuesCount: integer("open_issues_count")
```

**Purpose:** Track issue count from GitHub metadata to detect changes

**Updated columns:**
- `languagesOrdered`: Nullable (filled by data-service)
- `languagesRaw`: Nullable (filled by data-service)
- `processingStatus`: Tracks if repo has been processed
- `processedAt`: When repo processing completed

### Issues Table

No schema changes, but usage changes:
- Discovery service: Inserts/updates basic metadata
- Data service: Adds AI content

## Queue Message Types

```typescript
// apps/scraper-service/service-bindings.d.ts
type ProcessingQueueMessage =
  | { type: "process_repo"; repoId: number }
  | { type: "process_issue"; issueId: number };

// No more scraper-continuation-queue needed!
```

## Data Flow

### New Repo Discovered

```
1. Discovery: Fetch from awesome-for-beginners
   → Found: "facebook/react"
   
2. Discovery: Check DB
   → Not found
   
3. Discovery: Fetch GitHub metadata
   GET /repos/facebook/react
   → { open_issues_count: 847, ... }
   
4. Discovery: Insert into DB
   INSERT INTO repos (owner, name, open_issues_count, ...)
   → repo.id = 123
   
5. Discovery: Queue for processing
   → { type: "process_repo", repoId: 123 }
   
6. Data Service: Consume message
   → Fetch repo #123 from DB
   
7. Data Service: Fetch languages
   GET /repos/facebook/react/languages
   → { "JavaScript": 12345, "TypeScript": 6789 }
   
8. Data Service: Generate AI summary
   → "React is a JavaScript library..."
   
9. Data Service: Update DB
   UPDATE repos SET languages_ordered = [...], ai_summary = ...
   
10. Data Service: Fetch issues
    GET /repos/facebook/react/issues?label=good+first+issue&state=open
    → [{ number: 1234, title: "...", comments: 5 }, ...]
    
11. Data Service: Insert issues into DB
    INSERT INTO issues (repo_id, github_issue_number, ...)
    → issue.id = 456, 457, 458, ...
    
12. Data Service: Queue issues
    → { type: "process_issue", issueId: 456 }
    → { type: "process_issue", issueId: 457 }
    → { type: "process_issue", issueId: 458 }
    
13. Data Service: Consume issue messages (separately)
    → Fetch issue #456 from DB
    → Fetch full details from GitHub
    → Generate AI analysis
    → Update DB
```

### Repo Issue Count Changed

```
1. Discovery: Fetch from awesome-for-beginners
   → "facebook/react" (already exists in DB)
   
2. Discovery: Fetch GitHub metadata
   GET /repos/facebook/react
   → { open_issues_count: 892, ... }  // was 847
   
3. Discovery: Check DB
   → Found: repo.id = 123, open_issues_count = 847
   
4. Discovery: Detect change
   → 892 ≠ 847, issue count changed!
   
5. Discovery: Update DB
   UPDATE repos SET open_issues_count = 892, updated_at = now()
   
6. Discovery: Queue for processing
   → { type: "process_repo", repoId: 123 }
   
7. Data Service: Process repo
   → Fetches all issues again
   → Finds new issues, queues them
   → Updates existing issues if changed
```

## Benefits

### ✅ No Continuation Logic Needed

Discovery is cheap and always completes:
- ~150 repos × 2 subrequests = ~300 (well under limit)
- No complex cursor tracking
- No continuation queue

### ✅ Automatic Retry on Failure

Queue handles retries:
- Worker hits subrequest limit → terminates
- Queue retries with fresh worker (fresh quota)
- No manual retry logic needed

### ✅ Fine-Grained Processing

Process repos and issues independently:
- Repo fails? Only that repo retries
- Issue fails? Only that issue retries
- Better error isolation

### ✅ Scalable

Add more queue consumers:
- High load? Scale up data-service workers
- Process repos and issues in parallel
- Queue depth shows work remaining

### ✅ Idempotent

Safe to retry any operation:
- Repo processing: Updates existing data
- Issue processing: Updates existing data
- No duplicate entries

## Migration Path

1. ✅ Add `openIssuesCount` to schema
2. Generate migration
3. Apply to D1
4. Refactor scraper-service → discovery logic
5. Refactor data-service → repo + issue handlers
6. Update queue message types
7. Remove scraper-continuation-queue
8. Test end-to-end
9. Deploy

## Comparison: Old vs New

### Old Architecture Issues

❌ Discovery + Processing in one service
❌ Continuation queue needed (complex)
❌ Can't queue continuation if out of subrequests
❌ All-or-nothing processing
❌ Hard to debug failures

### New Architecture Benefits

✅ Discovery separated (always succeeds)
✅ No continuation logic needed
✅ Queue handles retry automatically
✅ Fine-grained error handling
✅ Easy to monitor (queue depth)
✅ Scalable (add more consumers)

## Implementation Status

- [x] Schema updated (openIssuesCount added)
- [ ] Generate migration
- [ ] Refactor scraper-service
- [ ] Refactor data-service
- [ ] Update queue bindings
- [ ] Update NEXT_STEPS.md
- [ ] Test locally
- [ ] Deploy

