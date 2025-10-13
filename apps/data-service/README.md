# Data Service (Processing Service)

Queue consumer service that processes repos and issues by fetching additional data and generating AI summaries.

## Purpose

- Consume messages from `processing-queue`
- Fetch repo languages from GitHub
- Fetch full issue bodies from GitHub
- Generate AI summaries for repos
- Generate AI analysis for issues
- Update database with results

## Architecture

```
scraper-service → processing-queue → data-service
                                          ↓
                                    GitHub API + Workers AI
                                          ↓
                                         D1
```

## Configuration

### Environment Variables

`.dev.vars`:
```bash
GITHUB_SCRAPER_TOKEN="your_github_pat"
ENABLE_R2_LOGGING="true"  # or "false"
```

### Wrangler Config

`wrangler.jsonc`:
- D1 Database: `contribot`
- Workers AI: Enabled
- R2 Bucket: `contribot-workflow-logs`
- Queue Consumer: `processing-queue` (batch size: 10)

## Development

```bash
# Local development (limited - no queue)
pnpm dev:local

# Remote development (with D1, AI, R2, Queue)
pnpm dev

# Deploy
pnpm deploy
```

## Queue Messages

Consumes from `processing-queue`:
- `{ type: "repo", id: number }` - Process repo (fetch languages + AI)
- `{ type: "issue", id: number }` - Process issue (fetch body + AI)

## Processing Flow

### For Repos
1. Fetch repo from database
2. Fetch languages from GitHub
3. Generate AI summary
4. Update repo with languages
5. Store AI summary
6. Mark as completed

### For Issues
1. Fetch issue from database
2. Fetch repo data for context
3. Fetch full issue body (if not already present)
4. Generate AI analysis
5. Store AI analysis
6. Mark as completed

## Subrequest Limit Handling

If hits 50 subrequest limit:
1. Throws error
2. Queue retries message in new invocation
3. Each invocation gets fresh 50 subrequest quota

## R2 Logs

Logs saved to: `logs/YYYY/MM/DD/data-service-{batchId}-{timestamp}.jsonl`

## Error Handling

- Subrequest errors → Retry (queue auto-retries)
- Auth errors → Ack (don't retry with invalid token)
- Other errors → Ack (log but don't retry)
- Failed items marked as `processing_status='failed'` in DB
