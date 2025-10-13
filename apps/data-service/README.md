# Contribot Data Service

Background worker service for scraping GitHub repositories and processing them with AI.

## 🏗️ Architecture

### Workflow-Based Scraping

The scraper runs as a **Cloudflare Workflow** triggered by cron every 6 hours.

**Flow:**
```
Cron Trigger (every 6 hours)
    ↓
ScraperWorkflow
    ↓
Step 1: Fetch repos from data sources (adapters)
    ↓
Step 2: Process repos (hash comparison, deduplication, GitHub API)
    ↓
Step 3: Fetch all repos for issue processing
    ↓
Step 4: Process issues (hash comparison, GitHub API)
    ↓
Step 5: Process AI queue (generate summaries)
    ↓
Step 6: Log summary
```

### Key Components

#### 1. **Adapters** (`src/scrapers/adapters/`)
- `base-adapter.ts` - Interface for all adapters
- `awesome-for-beginners.ts` - Fetches from awesome-for-beginners data.json
- `registry.ts` - Adapter registry with data source configs

#### 2. **Processors** (`src/scrapers/processors/`)
- `repo-processor.ts` - Handles repo deduplication and hash comparison
- `issue-processor.ts` - Handles issue hash comparison and updates

#### 3. **AI System** (`src/ai/`)
- `queue-processor.ts` - Batch processes AI queue items
- `summarizer.ts` - Workers AI interface (Llama 3.3)
- `prompts/` - Prompt templates for repos and issues

#### 4. **Utilities** (`src/utils/`)
- `github-api.ts` - GitHub API client with rate limiting (5000 req/hr)
- `hash.ts` - SHA-256 hashing for change detection

#### 5. **Workflow** (`src/workflows/`)
- `scraper-workflow.ts` - Main workflow orchestrating all steps

## 🚀 Setup

### 1. Build Data Ops Package

```bash
cd /Users/rossoc1/Desktop/contribot
pnpm --filter @repo/data-ops build
```

### 2. Set Environment Variables

Add your GitHub token to `.dev.vars` (create this file):

```
GITHUB_SCRAPER_TOKEN=ghp_your_token_here
```

For production, use secrets:

```bash
wrangler secret put GITHUB_SCRAPER_TOKEN
```

### 3. Apply Database Migrations

```bash
cd /Users/rossoc1/Desktop/contribot/packages/data-ops
pnpm drizzle:migrate
```

## 🧪 Testing

### Quick Start: Test Without Workflows (Recommended for Local Development)

**Best for local testing** - No deployment or remote bindings needed:

```bash
# 1. Start local dev server
cd apps/data-service
pnpm dev:local

# 2. Run scraper directly (all logic, no workflows)
curl http://localhost:8787/test-scraper-direct
```

This runs all the scraper logic (fetch repos → process → fetch issues → AI queue) directly without using Cloudflare Workflows.

**Two modes available:**

- **`/test-scraper-direct`** - Returns immediately, runs in background (check logs)
- **`/test-scraper-direct-blocking`** - Waits for completion, returns full stats

---

### Testing with Workflows

⚠️ **Workflows don't work with standard `wrangler dev`**. You have two options:

#### Option A: Test with Remote Bindings (Recommended)

Use `wrangler dev --remote` to connect to actual Cloudflare infrastructure:

```bash
cd apps/data-service
pnpm dev
# This runs: wrangler dev --remote
```

This connects to your deployed D1, AI, and Workflow bindings on Cloudflare.

**Alternative**: For development without workflows (API endpoints only):
```bash
pnpm dev:local
```

#### Option B: Deploy and Test in Production

```bash
cd apps/data-service
pnpm deploy
```

Then test against your deployed worker:
```bash
curl https://your-worker.workers.dev/test-scraper
```

### Manually Trigger the Workflow

You can test the workflow without waiting for cron:

```bash
# Using wrangler dev with scheduled event (remote mode)
wrangler dev --remote --test-scheduled
```

Or use the built-in HTTP endpoints:

#### Trigger the Workflow

```bash
# Start workflow via API
curl http://localhost:8787/test-scraper
```

**Note**: This will only work with `wrangler dev --remote` or in production.

Response:
```json
{
  "success": true,
  "message": "Scraper workflow started",
  "workflowInstanceId": "abc-123-def-456",
  "triggeredAt": "2025-01-15T10:30:00.000Z"
}
```

#### Check Workflow Status

```bash
curl http://localhost:8787/workflow/{instanceId}/status
```

Response:
```json
{
  "success": true,
  "instanceId": "abc-123-def-456",
  "status": {
    "status": "running",
    "output": {}
  }
}
```

Possible status values:
- `"queued"` - Waiting to be started (see concurrency limits)
- `"running"` - Currently executing
- `"paused"` - Paused
- `"waiting"` - Hibernating, waiting for sleep or event
- `"waitingForPause"` - Finishing current work to pause
- `"complete"` - Finished successfully
- `"errored"` - Failed with an error
- `"terminated"` - User terminated while running
- `"unknown"` - Status cannot be determined

#### Stop a Workflow

```bash
curl -X POST http://localhost:8787/workflow/{instanceId}/stop
```

Response:
```json
{
  "success": true,
  "message": "Workflow terminated successfully",
  "instanceId": "abc-123-def-456"
}
```

⚠️ **Note:** Once stopped/terminated, a Workflow instance cannot be resumed.

#### List Available Endpoints

```bash
curl http://localhost:8787/workflows
```

## 📊 Database Schema

### Tables

1. **repos** - Unique repositories
   - Stores: owner, name, languages, good-first-issue tag
   - Hash: `SHA256(owner + name + languages + tag)`
   - Deduplication: Unique on `(owner, name)`

2. **issues** - Good first issues
   - Stores: title, body, state, comment count, assignees
   - Hash: `SHA256(comment_count + state + assignees)`
   - Unique on: `(repo_id, github_issue_number)`

3. **ai_summary_queue** - Queue for AI processing
   - Status: pending, processing, completed, failed
   - Batch size: 10 items at a time
   - Max attempts: 3

4. **ai_summaries** - AI-generated content
   - Repo summaries (1 paragraph)
   - Issue intros (2-3 sentences)
   - Difficulty scores (1-5)
   - First steps guidance

## 📖 Complete Workflow Management Example

Here's a complete example of starting, monitoring, and managing a workflow:

```bash
# 1. Start the development server
cd apps/data-service
pnpm dev

# 2. In another terminal, start a workflow and capture the response
curl http://localhost:8787/test-scraper

# Example response:
# {
#   "success": true,
#   "workflowInstanceId": "abc-123-def-456",
#   "triggeredAt": "2025-01-15T10:30:00.000Z"
# }

# 3. Check the status (replace with your actual instance ID)
curl http://localhost:8787/workflow/abc-123-def-456/status

# 4. Monitor status in real-time (updates every 2 seconds)
watch -n 2 "curl -s http://localhost:8787/workflow/abc-123-def-456/status | jq"

# 5. If needed, stop the workflow
curl -X POST http://localhost:8787/workflow/abc-123-def-456/stop
```

### Direct Run Examples

#### Non-Blocking (Background)

Returns immediately, scraper runs in background:

```bash
curl http://localhost:8787/test-scraper-direct
```

Response:
```json
{
  "success": true,
  "message": "Direct scraper run started (check logs for progress)",
  "mode": "direct"
}
```

Watch the terminal where you ran `pnpm dev:local` to see progress.

#### Blocking (Wait for Completion)

Waits for scraper to complete, returns full statistics:

```bash
curl http://localhost:8787/test-scraper-direct-blocking
```

Response:
```json
{
  "success": true,
  "message": "Direct scraper run completed",
  "stats": {
    "repos": {
      "processed": 150,
      "new": 10,
      "updated": 5,
      "unchanged": 135,
      "errors": 0
    },
    "issues": {
      "processed": 450,
      "new": 25,
      "updated": 12,
      "unchanged": 413,
      "errors": 0
    },
    "aiProcessing": {
      "processed": 37,
      "success": 37,
      "failed": 0,
      "remaining": 0
    },
    "githubApiRequests": {
      "made": 165,
      "remaining": 4835,
      "maxPerHour": 5000
    },
    "duration": 45230
  }
}
```

---

## 📊 Testing Comparison

| Feature | Direct Run | Workflows |
|---------|-----------|-----------|
| **Setup Required** | None | Deploy first |
| **Command** | `pnpm dev:local` | `pnpm dev` (--remote) |
| **Best For** | Local development | Production testing |
| **Speed** | Immediate | Requires deployment |
| **Limitations** | No workflow features | Must deploy changes |
| **Endpoint** | `/test-scraper-direct` | `/test-scraper` |

**Recommendation**: Use **Direct Run** for local testing and development. Use **Workflows** when testing the actual production behavior.

---

### Automated Monitoring Script

Save this as `monitor-workflow.sh`:

```bash
#!/bin/bash

# Start workflow and extract instance ID
RESPONSE=$(curl -s http://localhost:8787/test-scraper)
INSTANCE_ID=$(echo $RESPONSE | jq -r '.workflowInstanceId')

echo "✓ Workflow started: $INSTANCE_ID"
echo ""

# Monitor until complete
while true; do
  STATUS=$(curl -s "http://localhost:8787/workflow/$INSTANCE_ID/status" | jq -r '.status.status')
  echo "Status: $STATUS ($(date +%H:%M:%S))"
  
  if [[ "$STATUS" == "complete" ]] || [[ "$STATUS" == "errored" ]] || [[ "$STATUS" == "terminated" ]]; then
    echo "✓ Workflow finished with status: $STATUS"
    break
  fi
  
  sleep 5
done
```

Make it executable and run:
```bash
chmod +x monitor-workflow.sh
./monitor-workflow.sh
```

---

## 🔧 Configuration

### Cron Schedule

Currently set to run every 6 hours:

```jsonc
"triggers": {
  "crons": ["0 */6 * * *"]  // At :00 minutes, every 6 hours
}
```

To change frequency, update `wrangler.jsonc`.

### Data Sources

Configured in `src/scrapers/adapters/registry.ts`:

```typescript
export const DATA_SOURCE_CONFIGS: DataSourceConfig[] = [
  {
    id: "awesome-for-beginners",
    url: "https://raw.githubusercontent.com/MunGell/awesome-for-beginners/master/data.json",
    enabled: true,
  },
];
```

## 📈 Monitoring

### Workflow Logs

View workflow execution logs in Cloudflare dashboard:
1. Go to Workers & Pages
2. Select `contribot-data-service`
3. Click "Logs" or "Workflows"

### Key Metrics to Monitor

- **Repos processed**: new / updated / unchanged
- **Issues processed**: new / updated / unchanged
- **GitHub API requests**: should stay under 5000/hour
- **AI queue**: pending / completed / failed
- **Workflow duration**: should complete within timeout

## 🔐 Security

- GitHub token requires only **read-only** access (no write permissions)
- Use Wrangler secrets for production tokens (never commit)
- D1 database is private to the Worker
- AI prompts are sanitized and limited in length

## 🐛 Troubleshooting

### Error: "Workflow binding not available"

**Cause**: You're running `wrangler dev` without the `--remote` flag.

**Solution**: Use remote bindings:
```bash
cd apps/data-service
pnpm dev  # This uses --remote by default
```

Or if calling wrangler directly:
```bash
wrangler dev --remote
```

**Why**: Workflows require connection to Cloudflare infrastructure and don't work in local-only mode.

---

### Workflow Not Running

Check cron triggers:
```bash
wrangler tail --format json
```

### GitHub API Rate Limit

- Current limit: 5000 requests/hour
- Check logs for rate limit warnings
- Adjust `MIN_DELAY_MS` in `github-api.ts` if needed

### AI Queue Stuck

Query the queue status:
```sql
SELECT status, COUNT(*) FROM ai_summary_queue GROUP BY status;
```

Reset stuck items:
```sql
UPDATE ai_summary_queue 
SET status = 'pending', attempts = 0 
WHERE status = 'processing' 
AND created_at < datetime('now', '-30 minutes');
```

### Drizzle/TypeScript Errors

Make sure data-ops is built:
```bash
pnpm --filter @repo/data-ops build
```

## 📦 Deployment

```bash
pnpm deploy
```

This builds and deploys to Cloudflare Workers.

## 🔄 Adding New Data Sources

1. Create a new adapter in `src/scrapers/adapters/`:

```typescript
export class MyNewAdapter implements ScraperAdapter {
  id = "my-source";
  name = "My Source";

  async fetch(url: string): Promise<RepoSourceData[]> {
    // Fetch and parse data
    return [];
  }
}
```

2. Register it in `registry.ts`:

```typescript
constructor() {
  this.register(new AwesomeForBeginnersAdapter());
  this.register(new MyNewAdapter()); // Add this
}
```

3. Add config:

```typescript
export const DATA_SOURCE_CONFIGS: DataSourceConfig[] = [
  // ... existing
  {
    id: "my-source",
    url: "https://example.com/data.json",
    enabled: true,
  },
];
```

## 📚 Next Steps

- [ ] Add monitoring/alerting for failures
- [ ] Implement incremental scraping (only fetch changed issues)
- [ ] Add more data sources (up-for-grabs, goodfirstissue.dev)
- [ ] Optimize AI prompts for better summaries
- [ ] Add webhook support for real-time updates
- [ ] Implement retry logic for failed AI processing
