# Architecture V2 - Implementation Summary

## 🎯 What Changed

Migrated from a **single scraper service with continuation logic** to a **discovery + processing pattern** that eliminates subrequest limit issues.

## ✨ Key Improvements

### Before (Architecture V1)
```
Scraper Service
├── Discover repos
├── Fetch repo languages ← Expensive
├── Fetch all issues ← Expensive  
├── Generate AI summaries ← Expensive
├── Hit subrequest limit ← Problem!
└── Queue continuation ← Complex workaround
```

**Problems:**
- ❌ Couldn't queue continuation if out of subrequests
- ❌ All-or-nothing processing
- ❌ Complex cursor tracking
- ❌ Hard to debug failures

### After (Architecture V2)
```
Discovery Service (scraper-service)
├── Fetch repos from sources
├── Get open_issues_count from GitHub
├── Update database
└── Queue repos for processing ← Always succeeds!

↓ Queue: processing-queue

Data Service
├── Process Repo Messages
│   ├── Fetch languages
│   ├── Generate AI summary
│   ├── Fetch/insert issues
│   └── Queue issues
└── Process Issue Messages
    ├── Fetch full details
    └── Generate AI analysis
```

**Benefits:**
- ✅ Discovery always completes (only ~300 subrequests for 150 repos)
- ✅ Processing auto-retries via queue (fresh quota each time)
- ✅ Fine-grained error handling (repo/issue level)
- ✅ Easy to monitor (queue depth)
- ✅ Scalable (add more consumers)

## 📊 Architecture Comparison

| Aspect | V1 (Old) | V2 (New) |
|--------|----------|----------|
| **Services** | 1 (scraper) | 2 (discovery + data) |
| **Queues** | 3 (processing, scraper-continuation, 2 DLQs) | 2 (processing, 1 DLQ) |
| **Continuation Logic** | Manual cursor tracking | Not needed |
| **Subrequest Limits** | Hit frequently, complex workarounds | Rare, auto-retry |
| **Error Isolation** | All-or-nothing | Per repo/issue |
| **Monitoring** | R2 logs only | Queue depth + R2 logs |
| **Scalability** | Limited | Horizontal (add consumers) |

## 🏗️ New Structure

### Discovery Service (`apps/scraper-service`)

**Purpose:** Find repos and queue them for processing

**Files Created:**
- `src/discovery/processor.ts` - Discovery logic
- `src/discovery/run.ts` - Main entry point

**Files Modified:**
- `src/index.ts` - Removed queue consumer, simplified
- `src/utils/github-api.ts` - Added `fetchRepoMetadata()`
- `service-bindings.d.ts` - Updated message types
- `wrangler.jsonc` - Removed continuation queue

**Responsibilities:**
1. Fetch repos from data sources (awesome-for-beginners)
2. Call GitHub API for repo metadata (`open_issues_count`)
3. Insert/update repos in database
4. Queue repos that are new or changed

**Subrequest Usage:** ~2 per repo (1 GitHub API, 1 DB write) = ~300 for 150 repos ✅

### Data Service (`apps/data-service`)

**Purpose:** Process repos and issues (expensive operations)

**Files Created:**
- `src/processor/repo-processor.ts` - Repo processing
- `src/processor/issue-processor.ts` - Issue processing

**Files Modified:**
- `src/index.ts` - Queue consumer for both message types
- `service-bindings.d.ts` - Updated message types
- `wrangler.jsonc` - Added queue producer binding

**Responsibilities:**
1. **Repo Processing:**
   - Fetch languages from GitHub
   - Generate AI summary
   - Fetch all issues
   - Insert/update issues (batched)
   - Queue issues for processing

2. **Issue Processing:**
   - Fetch full issue details
   - Generate AI analysis
   - Update database

**Error Handling:**
- Subrequest limit hit → Terminate, queue retries with fresh quota
- Other errors → Log and ack (prevent infinite retries)

## 🔄 Data Flow

### New Repo Discovery

```
1. Discovery Service
   └─→ Fetch from awesome-for-beginners
   └─→ Get GitHub metadata (open_issues_count)
   └─→ INSERT INTO repos
   └─→ QUEUE { type: "process_repo", repoId: 123 }

2. Data Service (consumes repo message)
   └─→ Fetch languages
   └─→ Generate AI summary
   └─→ Fetch all issues
   └─→ BATCH INSERT issues (6 per batch, D1 limit)
   └─→ QUEUE { type: "process_issue", issueId: 456 }
   └─→ QUEUE { type: "process_issue", issueId: 457 }
   └─→ ...

3. Data Service (consumes issue messages)
   └─→ Fetch full issue details
   └─→ Generate AI analysis
   └─→ UPDATE issues
```

### Issue Count Changed

```
1. Discovery Service
   └─→ Fetch from awesome-for-beginners
   └─→ Get GitHub metadata (open_issues_count: 892, was 847)
   └─→ UPDATE repos SET open_issues_count = 892
   └─→ QUEUE { type: "process_repo", repoId: 123 }

2. Data Service
   └─→ Fetch all issues again
   └─→ Find new/changed issues
   └─→ Queue them for processing
```

## 📝 Database Changes

### New Column: `repos.openIssuesCount`

```sql
ALTER TABLE repos ADD COLUMN open_issues_count INTEGER;
```

**Purpose:** Detect when issue count changes (triggers reprocessing)

**Updated Interfaces:**
```typescript
// packages/data-ops/src/queries/repos.ts
interface CreateRepoData {
  // ... existing fields
  openIssuesCount: number | null;  // NEW
}

interface UpdateRepoData {
  // ... existing fields
  openIssuesCount?: number | null;  // NEW
}
```

## 🎛️ Queue Messages

### Processing Queue

Handles both repo and issue processing:

```typescript
type ProcessingQueueMessage =
  | { type: "process_repo"; repoId: number }
  | { type: "process_issue"; issueId: number };
```

**Sent by:**
- Discovery Service → `process_repo` messages
- Data Service (repo processor) → `process_issue` messages

**Consumed by:**
- Data Service (unified consumer)

## 🧹 What to Clean Up

See `CLEANUP_CHECKLIST.md` for complete list.

**TL;DR:**
- Delete `scraper-continuation-queue` (Cloudflare)
- Delete `scraper-dlq` (Cloudflare)
- Optional: Delete old code after verification

## 🚀 Deployment Steps

1. **Apply database migration** (add `openIssuesCount`)
2. **Rebuild packages** (`data-ops`, `r2-logger`)
3. **Regenerate types** (both services)
4. **Deploy discovery service** (scraper-service)
5. **Deploy data service**
6. **Test end-to-end**
7. **Monitor queues and logs**
8. **Clean up old resources**

See `NEXT_STEPS.md` for detailed commands.

## 📈 Performance Expectations

### Discovery Service

- **Frequency:** Every 12 hours (cron)
- **Duration:** ~5-10 minutes for 150 repos
- **Subrequests:** ~300 (well under limit)
- **Success Rate:** 100% (barring GitHub API issues)

### Data Service

- **Frequency:** Continuous (queue-driven)
- **Duration:** Varies by queue depth
- **Subrequests per repo:** ~100-200 (depends on issue count)
- **Success Rate:** High (auto-retries on limit)

### Queue Metrics

- **processing-queue depth:** Varies (spikes after discovery runs)
- **processing-dlq depth:** Should be near 0 (only hard failures)
- **Message processing rate:** ~5-10 per minute (rate-limited)

## 🐛 Debugging

### Discovery Service

```bash
# Check logs
cd apps/scraper-service
wrangler tail

# Trigger manually
curl -X POST https://contribot-scraper-service.<subdomain>.workers.dev/trigger

# Check R2 logs
wrangler r2 object list contribot-workflow-logs --prefix logs/
```

### Data Service

```bash
# Check logs
cd apps/data-service
wrangler tail

# Check queue depth
wrangler queues list

# Inspect messages (if needed)
wrangler queues consumer inspect processing-queue
```

### Database

```bash
# Check repos
wrangler d1 execute contribot --remote --command="
  SELECT 
    id, owner, name, open_issues_count, processing_status 
  FROM repos 
  LIMIT 10;
"

# Check issues
wrangler d1 execute contribot --remote --command="
  SELECT 
    id, github_issue_number, title, processing_status 
  FROM issues 
  LIMIT 10;
"
```

## ✅ Success Criteria

After deployment, verify:

- [ ] Discovery service runs successfully
- [ ] Repos appear in `processing-queue`
- [ ] Data service processes repo messages
- [ ] Issues appear in `processing-queue`
- [ ] Data service processes issue messages
- [ ] R2 logs show successful runs
- [ ] Database has `openIssuesCount` populated
- [ ] No errors in dashboard

## 🎉 What You Get

- **Reliable discovery** - Always completes, no continuation logic
- **Scalable processing** - Add more queue consumers as needed
- **Fine-grained retries** - Failed repos/issues retry independently
- **Easy monitoring** - Queue depth shows work remaining
- **Clean architecture** - Separation of concerns
- **Production-ready** - Handles D1 limits, GitHub rate limits, subrequest limits

---

**Architecture V2 is complete and ready to deploy! 🚀**

See `CLEANUP_CHECKLIST.md` for next steps.

