# Phase 1: Infrastructure and Scraper - Implementation Plan

## 🎯 Overview & Goals

Build the autonomous intelligence layer that keeps the database fresh with beginner-friendly GitHub issues. This phase establishes:

1. **Database schema** for repos, issues, and AI summaries
2. **Scraper Worker** with adapter pattern for multiple data sources
3. **Hash-based change detection** to minimize updates and AI calls
4. **AI Summarization Worker** for generating repo summaries and issue insights
5. **Queue system** to decouple scraping from AI processing

---

## 📊 Database Schema

### Core Tables

#### `repos`
Stores unique repositories discovered from data sources.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment unique identifier |
| `owner` | TEXT NOT NULL | GitHub repo owner (e.g., "apache") |
| `name` | TEXT NOT NULL | Repo name (e.g., "superset") |
| `github_url` | TEXT NOT NULL | Full URL: `github.com/{owner}/{name}` |
| `languages_ordered` | TEXT (JSON) | Ordered array of languages for hashing: `["Python", "TypeScript"]` |
| `languages_raw` | TEXT (JSON) | Raw GitHub API response: `{"Python": 12345, "TypeScript": 5678}` |
| `good_first_issue_tag` | TEXT NOT NULL | Label to query (e.g., "good first issue") |
| `data_source_id` | TEXT NOT NULL | First data source that discovered it (e.g., "awesome-for-beginners") |
| `metadata_hash` | TEXT NOT NULL UNIQUE | SHA-256 hash of `owner + name + languages_ordered + gfi_tag` |
| `created_at` | INTEGER NOT NULL | Timestamp (ms) |
| `updated_at` | INTEGER NOT NULL | Timestamp (ms) |

**Indexes:**
- Unique constraint on `(owner, name)` for deduplication
- Index on `metadata_hash` for fast change detection

---

#### `issues`
Stores individual issues tagged with good-first-issue labels.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment unique identifier |
| `repo_id` | INTEGER NOT NULL | Foreign key to `repos.id` |
| `github_issue_number` | INTEGER NOT NULL | Issue number from GitHub |
| `title` | TEXT NOT NULL | Issue title |
| `body` | TEXT | Issue description/body |
| `state` | TEXT NOT NULL | "open" or "closed" |
| `comment_count` | INTEGER NOT NULL | Number of comments |
| `assignee_status` | TEXT | JSON array of assignees or NULL if unassigned |
| `github_url` | TEXT NOT NULL | Computed: `github.com/{owner}/{name}/issues/{number}` |
| `metadata_hash` | TEXT NOT NULL | SHA-256 hash of `comment_count + state + assignee_status` |
| `created_at` | INTEGER NOT NULL | GitHub issue creation timestamp (ms) |
| `updated_at` | INTEGER NOT NULL | GitHub issue last updated timestamp (ms) |
| `scraped_at` | INTEGER NOT NULL | When we last scraped this issue (ms) |

**Indexes:**
- Unique constraint on `(repo_id, github_issue_number)`
- Index on `metadata_hash` for fast change detection
- Index on `state` for filtering open issues
- Index on `repo_id` for efficient joins

---

#### `ai_summary_queue`
Queue for AI processing tasks. Decouples scraping from AI generation.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment unique identifier |
| `entity_type` | TEXT NOT NULL | "repo" or "issue" |
| `entity_id` | INTEGER NOT NULL | Foreign key to repos or issues |
| `status` | TEXT NOT NULL | "pending", "processing", "completed", "failed" |
| `priority` | INTEGER DEFAULT 0 | Higher = process first (for future use) |
| `attempts` | INTEGER DEFAULT 0 | Number of processing attempts |
| `error_message` | TEXT | Last error if failed |
| `created_at` | INTEGER NOT NULL | Timestamp (ms) |
| `processed_at` | INTEGER | Timestamp when completed (ms) |

**Indexes:**
- Index on `(status, priority DESC, created_at ASC)` for efficient queue polling
- Index on `(entity_type, entity_id)` to prevent duplicate queue entries

---

#### `ai_summaries`
Stores AI-generated content for repos and issues.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment unique identifier |
| `entity_type` | TEXT NOT NULL | "repo" or "issue" |
| `entity_id` | INTEGER NOT NULL | Foreign key to repos or issues |
| `repo_summary` | TEXT | AI-generated repo summary (1 paragraph) |
| `issue_intro` | TEXT | AI-generated issue introduction (2-3 sentences) |
| `difficulty_score` | INTEGER | 1-5 scale (only for issues) |
| `first_steps` | TEXT | AI-suggested first steps (only for issues) |
| `created_at` | INTEGER NOT NULL | Timestamp (ms) |
| `updated_at` | INTEGER NOT NULL | Timestamp (ms) |

**Indexes:**
- Unique constraint on `(entity_type, entity_id)` - one summary per entity
- Index on `difficulty_score` for filtering issues by difficulty

---

## 🏗️ Architecture Components

### 1. **Scraper Worker** (`apps/data-service/src/scrapers/`)

Main cron-triggered worker that orchestrates scraping.

**Key Files:**
```
src/
  scrapers/
    index.ts                    # Main cron handler
    orchestrator.ts             # Coordinates adapter execution
    adapters/
      base-adapter.ts           # Abstract base class for adapters
      awesome-for-beginners.ts  # First concrete adapter
      registry.ts               # Adapter registry/factory
    processors/
      repo-processor.ts         # Hash comparison & DB updates for repos
      issue-processor.ts        # Hash comparison & DB updates for issues
    utils/
      hash.ts                   # SHA-256 hashing utilities
      github-api.ts             # GitHub API client wrapper
```

**Adapter Pattern:**
```typescript
// Base interface all adapters implement
interface ScraperAdapter {
  id: string;
  fetch(url: string): Promise<RepoSourceData[]>;
}

interface RepoSourceData {
  name: string;           // e.g., "superset"
  owner: string;          // e.g., "apache"
  dataSourceId: string;   // e.g., "awesome-for-beginners"
  goodFirstIssueTag: string; // e.g., "good first issue"
  languagesOrdered: string[]; // Will be populated by processor
}
```

---

### 2. **AI Summarization Worker** (`apps/data-service/src/ai/`)

Worker that processes the AI queue. **Triggered after scraper completes** (not on separate schedule).

**Key Files:**
```
src/
  ai/
    index.ts                # Queue processor (triggered by scraper)
    summarizer.ts           # Workers AI integration
    prompts/
      repo-summary.ts       # Prompt template for repo summaries
      issue-analysis.ts     # Prompt template for issue analysis
```

**Processing Logic:**
1. Called by scraper orchestrator after scraping completes
2. Poll `ai_summary_queue` for pending items (batch of 10)
3. Fetch entity data from D1
4. Generate prompts based on entity type
5. Call Workers AI (Llama 3.3)
6. Parse and store results in `ai_summaries`
7. Update queue status to "completed" or "failed"
8. Continue until queue is empty or timeout reached

---

### 3. **Queue Management** (`packages/data-ops/src/queries/`)

Drizzle queries for queue operations.

**Key Operations:**
- `enqueueRepo(repoId)` - Add repo to AI queue
- `enqueueIssue(issueId)` - Add issue to AI queue
- `getPendingQueueItems(limit)` - Fetch batch for processing
- `markQueueItemProcessing(id)` - Update status to prevent duplicate processing
- `completeQueueItem(id, result)` - Mark as completed
- `failQueueItem(id, error)` - Mark as failed with error message

---

## 🔄 Implementation Steps

### Step 1: Database Schema & Migration
1. Create `packages/data-ops/src/drizzle/schema.ts` with all 4 tables
2. Add indexes and constraints
3. Generate migration: `pnpm --filter @repo/data-ops drizzle:generate`
4. Apply migration to D1: `pnpm --filter @repo/data-ops drizzle:migrate`

### Step 2: Core Utilities
1. Implement `hash.ts` - SHA-256 hashing helper
2. Implement `github-api.ts` - GitHub API client with:
   - Language fetching
   - Issue fetching with pagination
   - Rate limit tracker (5000 requests/hour max)
   - Automatic throttling when approaching limit
   - Request queue with delays to stay under limit
   - Error retry logic with exponential backoff

### Step 3: Adapter Infrastructure
1. Create `base-adapter.ts` interface
2. Create `registry.ts` for adapter registration
3. Implement `awesome-for-beginners.ts` adapter:
   - Fetch data.json from GitHub
   - Parse JSON structure
   - Map to `RepoSourceData[]`
4. Create hardcoded config with data source URL

### Step 4: Repo Processing
1. Implement `repo-processor.ts`:
   - Receive `RepoSourceData[]` from adapter
   - For each repo:
     - Check if repo exists (query by owner + name)
     - Fetch languages from GitHub API (with rate limiting)
     - Compute metadata hash
     - If repo doesn't exist:
       * Insert new repo
       * Enqueue for AI
     - If repo exists:
       * Compare new hash with existing hash
       * If hash differs (second source has newer data):
         + Update repo with new information
         + Enqueue for AI
       * If hash matches: skip (duplicate with same data)
2. Add Drizzle queries in `packages/data-ops/src/queries/repos.ts`
3. Implement GitHub API rate limiter with tracking

### Step 5: Issue Processing
1. Implement `issue-processor.ts`:
   - For each repo (new or updated), fetch issues:
     - Query GitHub API: `GET /repos/{owner}/{name}/issues?labels={gfi_tag}&state=open`
     - Parse response
     - For each issue:
       - Compute metadata hash
       - Compare with existing hash
       - If new or changed: upsert issue + enqueue for AI
2. Add Drizzle queries in `packages/data-ops/src/queries/issues.ts`

### Step 6: Orchestrator
1. Implement `orchestrator.ts`:
   - Load adapter config
   - Execute adapters in sequence
   - Pass results to repo processor
   - Pass repos to issue processor
   - Log summary statistics
   - **After scraping completes, trigger AI queue processor**
   - Return overall execution summary
2. Implement main cron handler in `index.ts`

### Step 7: Wrangler Cron Configuration
1. Update `apps/data-service/wrangler.jsonc`:
   - Add D1 binding
   - Add AI binding (for Workers AI)
   - Add cron trigger: `"0 */6 * * *"` (every 6 hours)
   - Add environment variables for GitHub token

### Step 8: AI Summarization Worker
1. Implement `summarizer.ts`:
   - Workers AI client setup
   - Batch processing logic (process in batches of 10)
   - Prompt generation from templates
   - Timeout handling (max 5 minutes total)
2. Implement prompt templates:
   - `repo-summary.ts`: Generate 1-paragraph summary
   - `issue-analysis.ts`: Generate intro + difficulty + first steps
3. Export function to be called by orchestrator (not separate cron)
4. Add Drizzle queries in `packages/data-ops/src/queries/ai-queue.ts`

### Step 9: Queue Processing Logic
1. Implement queue polling (triggered after scraper completes)
2. Fetch pending items (batch size: 10)
3. Process each item through AI
4. Update queue status + store results
5. Error handling with retry logic (max 3 attempts)
6. Continue processing until queue empty or 5-minute timeout
7. Return processing summary statistics

---

## 📈 Data Flow

### Scraper Flow (Every 6 Hours)

```
1. Cron Trigger
   ↓
2. Orchestrator loads config
   ↓
3. For each data source:
   ↓
4. Adapter.fetch(url) → RepoSourceData[]
   ↓
5. RepoProcessor.process():
   a. For each repo:
      - Query D1: check if (owner, name) exists
      - Fetch languages from GitHub API (with rate limiting)
      - Compute metadata hash
   b. If repo doesn't exist:
      - Insert into repos table
      - Enqueue for AI (entity_type="repo")
   c. If repo exists:
      - Compare new hash with stored hash
      - If hash differs (newer/different data from new source):
        * Update repos table with new data
        * Update data_source_id to current source
        * Enqueue for AI (regenerate summary with new data)
      - If hash matches:
        * Skip (duplicate, same information)
        * Log: "Repo already tracked with same data"
   ↓
6. IssueProcessor.process():
   For each repo (new or updated):
   a. Fetch open issues with gfi_tag from GitHub API
   b. For each issue:
      - Compute hash (comment_count + state + assignee)
      - If new issue:
        * Insert into issues table
        * Enqueue for AI (entity_type="issue")
      - If existing issue:
        * Compute new hash
        * If hash changed:
          + Update issues table
          + Enqueue for AI
        * Else: skip
   ↓
7. Log statistics:
   - Repos processed: X new, Y updated, Z unchanged
   - Issues processed: X new, Y updated, Z unchanged
   - Queue items added: X repos, Y issues
   - GitHub API requests made: X / 5000 limit
   ↓
8. Trigger AI Queue Processor:
   - Process queue in batches of 10
   - Continue until queue empty or 5-minute timeout
   - Log AI processing results
```

### AI Summarization Flow (Triggered After Scraper Completes)

```
1. Queue Processor triggered by orchestrator
   ↓
2. Query ai_summary_queue:
   WHERE status = "pending"
   ORDER BY priority DESC, created_at ASC
   LIMIT 10
   ↓
3. For each queue item:
   a. Update status to "processing"
   b. Fetch entity data (repo or issue)
   c. Generate prompt from template
   d. Call Workers AI (Llama 3.3):
      - Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast
      - Temperature: 0.7
      - Max tokens: 500 (repos), 800 (issues)
   e. Parse AI response
   f. Store in ai_summaries table
   g. Update queue status to "completed"
   h. On error:
      - Increment attempts
      - If attempts < 3: reset status to "pending"
      - If attempts >= 3: set status to "failed"
   ↓
4. Check if more items in queue:
   - If yes and time remaining: fetch next batch (go to step 2)
   - If no or timeout (5 min): exit
   ↓
5. Log summary:
   - Items processed: X
   - Success: Y
   - Failed: Z
   - Remaining in queue: N
```

---

## 🛡️ Error Handling

### GitHub API
- **Rate Limiting**: 
  - Track requests locally: max 5000/hour
  - Calculate delay between requests: `3600s / 5000 = 0.72s`
  - Add 100ms buffer between requests minimum
  - Check `X-RateLimit-Remaining` header from responses
  - If approaching limit (< 100 remaining): pause for remainder of hour
  - Store request count in memory with hourly reset
- **Network Errors**: Retry up to 3 times with exponential backoff
- **404 Not Found**: Log warning, skip that repo/issue
- **403 Forbidden**: Check token validity, alert admin
- **429 Too Many Requests**: Parse `Retry-After` header, wait and retry

### Workers AI
- **Timeout**: Set 30-second timeout per request
- **Total Processing Timeout**: Max 5 minutes for entire AI queue processing
- **Response Parsing**: Validate JSON structure, fallback to empty/default values
- **Cost Control**: Track AI calls, stop if approaching budget
- **Batch Processing**: Process in batches of 10 to avoid overwhelming the system

### Database
- **Constraint Violations**: Log warning, continue processing
- **Connection Errors**: Retry query once, then fail gracefully
- **Transaction Rollback**: Wrap batch operations in transactions where possible

### Queue Processing
- **Duplicate Prevention**: Check `(entity_type, entity_id)` before enqueuing
- **Stale Items**: If status="processing" for >30 minutes, reset to "pending"
- **Failed Items**: After 3 attempts, mark as "failed" and move on

---

## 🧪 Testing Strategy

### Manual Testing
1. **Adapter Testing**:
   - Run adapter with sample URL
   - Verify parsed data matches expected structure
   
2. **Hash Testing**:
   - Insert test repo with hash
   - Modify one field
   - Verify hash changes correctly

3. **End-to-End**:
   - Deploy to Cloudflare
   - Manually trigger cron: `wrangler dev --test-scheduled`
   - Check D1 tables for new data
   - Verify queue populated
   - Trigger AI worker
   - Verify summaries generated

### Monitoring
1. **Cloudflare Logs**: Track worker execution, errors
2. **Custom Logging**: Log key metrics (repos processed, issues found, queue size)
3. **Alerts**: Set up alerts for:
   - Worker failures
   - AI queue backlog > 1000 items
   - GitHub API rate limit exhausted

---

## 🚀 Deployment

### Environment Variables (wrangler.jsonc)
```jsonc
{
  "vars": {
    "GITHUB_SCRAPER_TOKEN": "ghp_xxxxx",  // Read-only token for scraping
    "AI_BATCH_SIZE": 10,
    "AI_MAX_ATTEMPTS": 3
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "contribot",
      "database_id": "...",
      "remote": true
    }
  ],
  "ai": {
    "binding": "AI"
  },
  "triggers": {
    "crons": ["0 */6 * * *"]  // Every 6 hours at :00
  }
  // Note: AI worker is NOT on separate cron - triggered by scraper
}
```

### Bindings
- `env.DB`: D1 database
- `env.AI`: Workers AI
- `env.GITHUB_SCRAPER_TOKEN`: GitHub personal access token

---

## 🔮 Future Considerations

### Phase 1 Scope Exclusions (for later phases)
- ❌ User-specific GitHub actions (forks, branches, PRs)
- ❌ MCP integration
- ❌ Real-time chat interaction
- ❌ Frontend dashboard
- ❌ Durable Objects for conversation state

### Key Design Decisions Made

#### Deduplication Strategy
- **Check by (owner, name)** - repos are unique by these fields
- **Update if newer data available** - second source can update first source's data
- **Hash comparison determines "newer"** - if hash differs, assume data changed
- **data_source_id tracks last updater** - helps debug which source provided current data

#### Rate Limiting Implementation
- **Local request counter** - track requests per hour in memory
- **Minimum 100ms delay** between requests (3600s / 5000 = 720ms theoretical max)
- **Proactive throttling** - slow down before hitting limit
- **Header validation** - verify actual remaining limit from GitHub response
- **Graceful degradation** - if limit reached, pause until next hour window

#### AI Queue Processing
- **Sequential execution** - scraper → AI processor (not parallel)
- **Reason**: Ensures AI has all new data before processing
- **Batch size 10** - balance between efficiency and memory
- **5-minute timeout** - prevents infinite loops, remaining items process next run

### Optimization Opportunities
1. **Parallel Processing**: Use Workers for Platforms to parallelize adapter execution
2. **Incremental Scraping**: Store last scrape time per data source, only fetch new issues
3. **Smart Queueing**: Priority queue based on issue age, repo popularity
4. **Caching**: Cache GitHub API responses in KV for 1 hour
5. **Webhook Integration**: Subscribe to GitHub webhooks for real-time updates (instead of polling)

### Additional Data Sources (Future Adapters)
- Up For Grabs (up-for-grabs.net)
- Good First Issue (goodfirstissue.dev)
- CodeTriage
- First Timers Only
- GitHub Search API (dynamic queries)

---

## ✅ Success Criteria

Phase 1 is complete when:

1. ✅ Database schema deployed to D1 with all 4 tables
2. ✅ Scraper worker running on 6-hour cron schedule
3. ✅ Awesome-for-beginners adapter fetching and parsing data.json
4. ✅ Repos table populated with deduplicated repositories
5. ✅ Issues table populated with open good-first-issues
6. ✅ Hash-based change detection working (skips unchanged data)
7. ✅ AI queue populated with new/changed entities
8. ✅ AI summarization worker processing queue
9. ✅ Summaries table populated with AI-generated content
10. ✅ Error handling and logging in place
11. ✅ Manual testing successful with real GitHub data

---

## 📋 Implementation Checklist

- [ ] Design and create Drizzle schema
- [ ] Generate and apply D1 migration
- [ ] Implement hashing utilities
- [ ] Implement GitHub API client
- [ ] Create adapter base interface
- [ ] Implement awesome-for-beginners adapter
- [ ] Implement repo processor with deduplication
- [ ] Implement issue processor
- [ ] Create queue management queries
- [ ] Implement orchestrator
- [ ] Configure cron trigger in wrangler
- [ ] Implement AI summarization worker
- [ ] Create prompt templates
- [ ] Implement AI queue processor
- [ ] Add error handling and retry logic
- [ ] Test end-to-end flow
- [ ] Deploy to Cloudflare
- [ ] Monitor first production runs

---

## 📚 Reference Links

- [GitHub REST API - Repositories](https://docs.github.com/en/rest/repos)
- [GitHub REST API - Issues](https://docs.github.com/en/rest/issues)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Drizzle ORM - SQLite](https://orm.drizzle.team/docs/get-started-sqlite)
- [Awesome for Beginners - data.json](https://github.com/MunGell/awesome-for-beginners/blob/master/data.json)

