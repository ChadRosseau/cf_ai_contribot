# Scraper Service

Metadata collection service that discovers repos and issues, compares with database, and queues items for processing.

## Purpose

- Fetch repos from data sources (awesome-for-beginners)
- Fetch issue metadata from GitHub (batch endpoint)
- Compare hashes with database
- Insert/update repos and issues
- Queue repos/issues needing processing

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
- R2 Bucket: `contribot-workflow-logs`
- Queue Producer: `processing-queue`
- Cron: Every 12 hours

## Development

```bash
# Local development (without remote bindings)
pnpm dev:local

# Remote development (with D1, R2, Queue)
pnpm dev

# Deploy
pnpm deploy
```

## Queue Messages

Sends to `processing-queue`:
- `{ type: "repo", id: number, priority: number }` - Repo needs processing
- `{ type: "issue", id: number, priority: number }` - Issue needs processing
- `{ type: "continue_scraping", cursor: ScraperCursor }` - Resume scraping

## Subrequest Limit Handling

If hits 50 subrequest limit:
1. Stops processing
2. Queues continuation message with cursor
3. Next invocation resumes from cursor

## R2 Logs

Logs saved to: `logs/YYYY/MM/DD/scraper-service-{runId}-{timestamp}.jsonl`

