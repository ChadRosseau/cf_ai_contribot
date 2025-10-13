# Phase 1 Architecture Rewrite: Service Split

## 🎯 Objective

Split the monolithic scraping + processing service into two specialized services to overcome Cloudflare's 50 subrequest/request limit.

## 🏗️ Architecture Overview

### Before (Single Service)
```
data-service (Workflow)
  ↓
Fetch repos → Process repos → Fetch issues → Process issues → AI queue
  ↓
❌ Hits 50 subrequest limit
```

### After (Two Services)
```
scraper-service (Worker, Cron 2x/day)
  ↓
Fetch repos → Fetch issue metadata → Compare hashes → Queue work
  ↓
processing-queue (Cloudflare Queue)
  ↓
data-service (Queue Consumer)
  ↓
Fetch languages/bodies → Generate AI summaries → Update DB
  ✅ Each consumer invocation = fresh 50 subrequest quota
```

---

## 📦 Service 1: scraper-service

### Purpose
Discover and track repos/issues, queue items needing processing.

### Responsibilities
1. Fetch repos from awesome-for-beginners data sources
2. Fetch issue metadata (title, state, comments, assignees) via GitHub batch endpoint
3. Calculate metadata hashes
4. Compare with database
5. Insert/update repos and issues in database
6. Queue repos/issues that need processing
7. Handle "too many subrequests" error by queuing continuation

### Location
- **New directory:** `apps/scraper-service/`

### Key Components
- `src/index.ts` - Worker entry point
- `src/scraper/run.ts` - Main scraping logic
- `src/scraper/adapters/` - Data source adapters (copy from data-service)
- `src/scraper/processors/` - Repo/issue processors (modified for metadata only)
- `src/utils/github-api.ts` - GitHub API client (copy from data-service)
- `src/utils/hash.ts` - Hash utilities (copy from data-service)
- `src/utils/r2-logger.ts` - R2 logging (copy from data-service)
- `wrangler.jsonc` - Config (copy from data-service, modify as needed)

### Cron Schedule
```jsonc
"triggers": {
  "crons": ["0 */12 * * *"]  // Every 12 hours (2x/day)
}
```

### Queue Integration
```typescript
// Queue a repo for processing
await env.PROCESSING_QUEUE.send({
  type: 'repo',
  id: repoId,
  priority: calculatePriority(repo.updatedAt)
});

// Queue an issue for processing
await env.PROCESSING_QUEUE.send({
  type: 'issue',
  id: issueId,
  priority: calculatePriority(issue.updatedAt)
});

// Queue continuation if hit subrequest limit
await env.PROCESSING_QUEUE.send({
  type: 'continue_scraping',
  cursor: { lastRepoIndex: 42, lastRepoOwner: 'electron', lastRepoName: 'electron' }
});
```

### Subrequest Handling
```typescript
try {
  await fetchIssuesMetadata(owner, name);
} catch (error) {
  if (error.message.includes('too many subrequests')) {
    console.log('Hit subrequest limit, queuing continuation...');
    await queueContinuation(currentState);
    return; // Stop processing
  }
  throw error;
}
```

### R2 Logging
- Log file format: `logs/YYYY/MM/DD/scraper-service-{runId}-{timestamp}.jsonl`
- Captures all scraping operations, hash comparisons, queue sends

---

## 📦 Service 2: data-service (Rewritten)

### Purpose
Process repos/issues by fetching additional data and generating AI summaries.

### Responsibilities
1. Consume messages from `processing-queue`
2. For repos: Fetch languages, generate AI summary
3. For issues: Fetch full issue body, generate AI analysis
4. Update database with results
5. Handle "too many subrequests" by throwing error (queue retries)
6. Process `continue_scraping` messages by triggering scraper-service

### Location
- **Existing directory:** `apps/data-service/` (rewrite)

### Key Components (Modified)
- `src/index.ts` - Queue consumer entry point
- `src/processor/repo-processor.ts` - NEW: Process single repo (languages + AI)
- `src/processor/issue-processor.ts` - NEW: Process single issue (body + AI)
- `src/ai/` - AI summarization (keep existing)
- `src/utils/github-api.ts` - GitHub API client (keep existing)
- `src/utils/r2-logger.ts` - R2 logging (update for service name)
- `wrangler.jsonc` - Update with queue consumer config

### Queue Consumer Config
```jsonc
{
  "queues": {
    "consumers": [
      {
        "queue": "processing-queue",
        "max_batch_size": 10,
        "max_retries": 3,
        "dead_letter_queue": "processing-dlq"
      }
    ]
  }
}
```

### Queue Consumer Handler
```typescript
export default {
  async queue(
    batch: MessageBatch<QueueMessage>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processMessage(message.body, env);
        message.ack(); // Success
      } catch (error) {
        if (error.message.includes('too many subrequests')) {
          message.retry(); // Retry in new invocation
        } else {
          console.error('Processing failed:', error);
          message.ack(); // Don't retry non-subrequest errors
        }
      }
    }
  }
}
```

### Subrequest Handling
```typescript
try {
  const languages = await fetchLanguages(owner, name);
  const summary = await generateAISummary(owner, name, languages);
  await updateRepo(id, { languages, summary, status: 'completed' });
} catch (error) {
  if (error.message.includes('too many subrequests')) {
    throw error; // Queue will retry this message
  }
  throw error;
}
```

### R2 Logging
- Log file format: `logs/YYYY/MM/DD/data-service-{batchId}-{timestamp}.jsonl`
- Captures all processing operations, API calls, AI generations

---

## 🗄️ Database Schema Changes

### 1. Add Processing Status Columns

**repos table:**
```sql
ALTER TABLE repos ADD COLUMN processing_status TEXT DEFAULT 'pending';
ALTER TABLE repos ADD COLUMN processed_at INTEGER; -- timestamp_ms
```

**issues table:**
```sql
ALTER TABLE issues ADD COLUMN processing_status TEXT DEFAULT 'pending';
ALTER TABLE issues ADD COLUMN processed_at INTEGER; -- timestamp_ms
```

### 2. Add Indexes
```sql
CREATE INDEX repos_processing_status_idx ON repos(processing_status);
CREATE INDEX repos_updated_at_idx ON repos(updated_at);
CREATE INDEX issues_processing_status_idx ON issues(processing_status);
CREATE INDEX issues_updated_at_idx ON issues(updated_at);
```

### 3. Remove ai_summary_queue Table
```sql
DROP TABLE ai_summary_queue;
```

### 4. Drizzle Schema Updates

**packages/data-ops/src/drizzle/schema.ts:**
```typescript
// Add to repos table
processingStatus: text("processing_status").notNull().default("pending"),
processedAt: integer("processed_at", { mode: "timestamp_ms" }),

// Add to issues table
processingStatus: text("processing_status").notNull().default("pending"),
processedAt: integer("processed_at", { mode: "timestamp_ms" }),

// Remove ai_summary_queue and ai_summaries exports
```

### 5. Update Queries

**packages/data-ops/src/queries/repos.ts:**
- Add `getReposByStatus(status: string, limit: number)`
- Add `updateRepoProcessingStatus(id: number, status: string, processedAt?: Date)`

**packages/data-ops/src/queries/issues.ts:**
- Add `getIssuesByStatus(status: string, limit: number)`
- Add `updateIssueProcessingStatus(id: number, status: string, processedAt?: Date)`

### 6. Migration Script

**packages/data-ops/src/drizzle/migrations/001_add_processing_status.sql:**
```sql
-- Add processing status to repos
ALTER TABLE repos ADD COLUMN processing_status TEXT DEFAULT 'pending';
ALTER TABLE repos ADD COLUMN processed_at INTEGER;

-- Add processing status to issues
ALTER TABLE issues ADD COLUMN processing_status TEXT DEFAULT 'pending';
ALTER TABLE issues ADD COLUMN processed_at INTEGER;

-- Add indexes
CREATE INDEX repos_processing_status_idx ON repos(processing_status);
CREATE INDEX repos_updated_at_idx ON repos(updated_at);
CREATE INDEX issues_processing_status_idx ON issues(processing_status);
CREATE INDEX issues_updated_at_idx ON issues(updated_at);

-- Set existing repos/issues to pending (will be processed)
UPDATE repos SET processing_status = 'pending';
UPDATE issues SET processing_status = 'pending';

-- Drop old queue table
DROP TABLE IF EXISTS ai_summary_queue;
```

---

## 🔄 Cloudflare Queue Configuration

### Queue Creation
```bash
wrangler queues create processing-queue
wrangler queues create processing-dlq  # Dead letter queue
```

### Queue Settings
- **Name:** `processing-queue`
- **Max batch size:** 10 messages
- **Max retries:** 3
- **Delivery delay:** 0 seconds
- **Message retention:** 4 days
- **Dead letter queue:** `processing-dlq`

### Message Types

```typescript
type QueueMessage = 
  | { type: 'repo'; id: number; priority: number }
  | { type: 'issue'; id: number; priority: number }
  | { type: 'continue_scraping'; cursor: ScraperCursor };

interface ScraperCursor {
  lastRepoIndex: number;
  lastRepoOwner: string;
  lastRepoName: string;
  dataSourceId: string;
}
```

---

## 📝 R2 Logging Updates

### File Naming Convention

**scraper-service:**
```
logs/YYYY/MM/DD/scraper-service-{runId}-{timestamp}.jsonl
```

**data-service:**
```
logs/YYYY/MM/DD/data-service-{batchId}-{timestamp}.jsonl
```

### R2Logger Updates

**src/utils/r2-logger.ts:**
```typescript
export class R2Logger {
  private serviceName: string;
  
  constructor(
    bucket: R2Bucket | null,
    enabled: boolean,
    runId: string,
    serviceName: string  // NEW
  ) {
    this.serviceName = serviceName;
    // ...
  }
  
  async flush(): Promise<void> {
    // File path: logs/YYYY/MM/DD/{serviceName}-{runId}-{timestamp}.jsonl
    const key = `logs/${year}/${month}/${day}/${this.serviceName}-${this.runId}-${timestamp}.jsonl`;
    // ...
  }
}
```

---

## 🔧 Implementation Steps

### Phase 0: Create r2-logger Package (Do First)
1. ✅ Create directory: `packages/r2-logger/`
2. ✅ Create `package.json` with exports
3. ✅ Move `r2-logger.ts` and `workflow-logger.ts` to `packages/r2-logger/src/`
4. ✅ Add TypeScript config
5. ✅ Build package: `pnpm --filter @repo/r2-logger build`

### Phase 1: Database Migration
1. ✅ Update Drizzle schema in `packages/data-ops/src/drizzle/schema.ts`
2. ✅ Add new query functions to `packages/data-ops/src/queries/`
3. ✅ Generate migration with `pnpm drizzle-kit generate`
4. ✅ Apply migration: `wrangler d1 execute contribot --remote --file=...`
5. ✅ Rebuild data-ops: `pnpm --filter @repo/data-ops build`

### Phase 2: Create Cloudflare Queue
1. ✅ Create queues: `wrangler queues create processing-queue`
2. ✅ Create DLQ: `wrangler queues create processing-dlq`
3. ✅ Test queue: `wrangler queues send processing-queue '{"type":"test"}'`

### Phase 3: Create scraper-service
1. ✅ Create directory: `apps/scraper-service/`
2. ✅ Copy `wrangler.jsonc` from data-service, modify:
   - Name: `contribot-scraper-service`
   - Remove workflows, AI bindings
   - Add queue producer binding
   - Update cron: `"0 */12 * * *"`
3. ✅ Copy `package.json`, update name
4. ✅ Copy `service-bindings.d.ts`, update types (add PROCESSING_QUEUE)
5. ✅ Create `src/index.ts` - Worker entry point
6. ✅ Copy and adapt scraper logic:
   - `src/scraper/run.ts` - Main logic
   - `src/scraper/adapters/` - Data source adapters
   - `src/scraper/processors/metadata-processor.ts` - Metadata only
   - `src/utils/` - Utilities (github-api, hash, r2-logger)
7. ✅ Implement continuation logic for subrequest limits
8. ✅ Update R2Logger to include service name
9. ✅ Deploy: `pnpm deploy`

### Phase 4: Rewrite data-service
1. ✅ Update `wrangler.jsonc`:
   - Remove cron triggers
   - Add queue consumer config
   - Keep D1, AI, R2 bindings
2. ✅ Update `service-bindings.d.ts` (remove SCRAPER_WORKFLOW, add queue types)
3. ✅ Rewrite `src/index.ts`:
   - Remove WorkerEntrypoint
   - Add queue consumer handler
   - Remove scheduled handler
4. ✅ Create new processors:
   - `src/processor/repo-processor.ts` - Fetch languages + AI
   - `src/processor/issue-processor.ts` - Fetch body + AI
5. ✅ Keep AI logic: `src/ai/` (no changes needed)
6. ✅ Update R2Logger to include service name
7. ✅ Remove old workflow files
8. ✅ Deploy: `pnpm deploy`

### Phase 5: Testing & Verification
1. ✅ Trigger scraper-service manually (via dashboard or API)
2. ✅ Monitor scraper-service logs in R2
3. ✅ Check queue has messages: `wrangler queues list-messages processing-queue`
4. ✅ Verify data-service is consuming messages (check logs)
5. ✅ Check database for updated records
6. ✅ Verify AI summaries are being generated
7. ✅ Monitor for "too many subrequests" errors
8. ✅ Test continuation logic (if scraper hits limit)

---

## 🎯 Success Criteria

1. ✅ scraper-service runs on cron 2x/day
2. ✅ scraper-service queues repos/issues needing processing
3. ✅ scraper-service handles subrequest limit gracefully (continuation)
4. ✅ data-service consumes queue messages
5. ✅ data-service processes repos (languages + AI)
6. ✅ data-service processes issues (body + AI)
7. ✅ data-service handles subrequest limit (retry via queue)
8. ✅ Both services log to R2 with service names
9. ✅ Database updated with processing status
10. ✅ No "too many subrequests" errors halt the system

---

## 📊 Expected Behavior

### Initial Scrape (scraper-service)
```
Cron triggers → scraper-service
  ↓
Fetch 150 repos from awesome-for-beginners (1 request)
  ↓
For each repo (sequential):
  - Fetch issues metadata (1-10 requests per repo)
  - Hash comparison
  - Queue changed repos/issues
  ↓
If hits ~45 subrequests → Queue continuation
  ↓
Finish (queued ~X repos, ~Y issues)
```

### Processing (data-service)
```
Queue consumer receives batch [repo1, repo2, issue1, ...]
  ↓
For each message:
  - Repo: Fetch languages (1 req) + AI (1 req) = 2 subrequests
  - Issue: Fetch body (1 req) + AI (1 req) = 2 subrequests
  ↓
Process ~20 items per invocation (40 subrequests)
  ↓
If hits limit → Throw error → Queue retries
  ↓
Queue auto-spawns next consumer for remaining items
```

---

## 🚨 Migration Notes

### Breaking Changes
1. ❌ Old workflow system removed
2. ❌ `ai_summary_queue` table removed
3. ❌ `/test-scraper` endpoints removed (temporarily)
4. ✅ New queue-based system

### Backward Compatibility
- ✅ Database: Repos/issues tables extended, not replaced
- ✅ AI logic: Reused as-is
- ✅ R2 logging: Enhanced, not changed

### Rollback Plan
If migration fails:
1. Restore `ai_summary_queue` table from backup
2. Redeploy old data-service version
3. Delete scraper-service
4. Delete queue

---

## 📚 Reference Documentation

- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- [Queue Consumers](https://developers.cloudflare.com/queues/configuration/configure-queues/)
- [D1 Migrations](https://developers.cloudflare.com/d1/platform/migrations/)
- [Drizzle ORM](https://orm.drizzle.team/)

---

## 🎉 Next Steps

After approval:
1. Begin Phase 1: Database Migration
2. Create Cloudflare Queue
3. Build scraper-service
4. Rewrite data-service
5. Deploy and test

**Ready to proceed?** 🚀

