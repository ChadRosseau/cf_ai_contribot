# R2 Logging Setup Guide

This guide covers how to set up and use R2 logging for workflow runs.

## 📦 Prerequisites

You need to create an R2 bucket to store workflow logs.

### Step 1: Create R2 Bucket

**Option A: Via Cloudflare Dashboard**
1. Go to your [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2 Object Storage**
3. Click **Create bucket**
4. Name it: `contribot-workflow-logs`
5. Leave it **Private** (default)
6. Click **Create bucket**

**Option B: Via Wrangler CLI**
```bash
wrangler r2 bucket create contribot-workflow-logs
```

### Step 2: Update Local Environment (Optional)

For local testing with R2 (requires `wrangler dev --remote`):

Edit `apps/data-service/.dev.vars`:
```bash
ENABLE_R2_LOGGING="true"
```

**Note**: For local development without remote bindings (`wrangler dev --local`), keep it as `"false"`.

### Step 3: Deploy

The R2 bucket binding is already configured in `wrangler.jsonc`:
```jsonc
"r2_buckets": [
  {
    "binding": "WORKFLOW_LOGS",
    "bucket_name": "contribot-workflow-logs"
  }
]
```

Deploy the worker:
```bash
cd apps/data-service
pnpm deploy
```

### Step 4: Enable in Production (Optional)

To enable R2 logging in production, set the environment variable via Wrangler or the dashboard:

```bash
wrangler secret put ENABLE_R2_LOGGING
# Enter: true
```

Or via dashboard:
1. Go to Workers & Pages
2. Select `contribot-data-service`
3. Go to Settings → Variables
4. Add variable: `ENABLE_R2_LOGGING` = `true`

---

## 📝 Log Format

Logs are stored as JSONL (JSON Lines) files in R2.

### File Structure

```
logs/
  └── YYYY/
      └── MM/
          └── DD/
              ├── run-workflow-1697207415123.jsonl
              ├── run-direct-1697208501234.jsonl
              └── ...
```

### Log Entry Format

Each line in a JSONL file is a JSON object:

```json
{
  "timestamp": "2025-10-13T14:30:15.123Z",
  "level": "info",
  "step": "fetch-repos-from-sources",
  "message": "Fetching repos from data sources...",
  "data": { "count": 150 },
  "duration": 1234
}
```

**Fields:**
- `timestamp` - ISO 8601 timestamp
- `level` - `"info"`, `"warn"`, or `"error"`
- `step` - Current workflow step name (optional)
- `message` - Log message
- `data` - Structured data (optional, e.g., stats, results)
- `duration` - Step duration in milliseconds (optional)
- `stack` - Error stack trace (only for errors)

---

## 🔍 Viewing Logs

### Via Cloudflare Dashboard

1. Go to R2 Object Storage
2. Open `contribot-workflow-logs` bucket
3. Navigate to `logs/YYYY/MM/DD/`
4. Download the log file you want to inspect
5. Open with a text editor or use `jq` for formatted viewing:

```bash
# Download from R2
wrangler r2 object get contribot-workflow-logs/logs/2025/10/13/run-workflow-1697207415123.jsonl --file=logs.jsonl

# View formatted with jq
cat logs.jsonl | jq '.'

# Filter by level
cat logs.jsonl | jq 'select(.level == "error")'

# Filter by step
cat logs.jsonl | jq 'select(.step == "process-repos")'

# View only messages
cat logs.jsonl | jq '.message'
```

### Via Wrangler CLI

List log files:
```bash
wrangler r2 object list contribot-workflow-logs --prefix=logs/2025/10/13/
```

Download a specific log file:
```bash
wrangler r2 object get contribot-workflow-logs/logs/2025/10/13/run-workflow-1697207415123.jsonl --file=workflow.jsonl
```

---

## ⚙️ Configuration

### Toggle Logging

**Disable logging** (e.g., for local development):
```bash
# In .dev.vars
ENABLE_R2_LOGGING="false"
```

**Enable logging** (e.g., for production):
```bash
# In .dev.vars or production secrets
ENABLE_R2_LOGGING="true"
```

### What Gets Logged

R2 logging captures:
- ✅ All `console.log()`, `console.warn()`, `console.error()` calls
- ✅ Workflow step start/end with timing
- ✅ Step results and statistics
- ✅ Errors with full stack traces
- ✅ Works for both workflows and direct test runs

---

## 🚨 Troubleshooting

### Logs Not Appearing in R2

**Check 1: Is logging enabled?**
```bash
# Check local env
cat apps/data-service/.dev.vars | grep ENABLE_R2_LOGGING

# Check production env
wrangler secret list
```

**Check 2: Is the R2 bucket created?**
```bash
wrangler r2 bucket list | grep contribot-workflow-logs
```

**Check 3: Check worker logs for errors**
```bash
wrangler tail
```

Look for messages like:
- `"R2 Logging: enabled"` - Confirms logging is on
- `"✓ Wrote X log entries to R2: logs/..."` - Confirms successful write
- `"Failed to write logs to R2"` - Indicates R2 write failure (non-fatal)

### R2 Bucket Permission Errors

If you see permission errors, ensure:
1. The bucket exists and is named correctly (`contribot-workflow-logs`)
2. The worker has the R2 bucket binding configured
3. You've deployed the worker after adding the binding

### No Logs for Workflow Runs

If direct runs log but workflows don't:
1. Ensure you're running with `wrangler dev --remote` (workflows require remote)
2. Deploy the worker for production workflow runs
3. Check that `ENABLE_R2_LOGGING` is set in production secrets

---

## 💡 Best Practices

1. **Local Development**: Keep `ENABLE_R2_LOGGING="false"` in `.dev.vars` to avoid errors when R2 isn't available locally
2. **Production**: Set `ENABLE_R2_LOGGING="true"` via secrets for deployed workers
3. **Log Retention**: R2 storage is cheap, but consider adding R2 lifecycle rules if you want automatic cleanup
4. **Monitoring**: Regularly check R2 logs for errors and performance issues
5. **Privacy**: R2 logs may contain sensitive data - keep the bucket private

---

## 📊 Example Usage

### Test Locally with Remote R2

```bash
cd apps/data-service

# Enable R2 logging in .dev.vars
echo 'ENABLE_R2_LOGGING="true"' >> .dev.vars

# Run with remote bindings
pnpm dev

# Trigger a test run
curl http://localhost:8787/test-scraper-direct

# Check R2 for logs
wrangler r2 object list contribot-workflow-logs --prefix=logs/
```

### Production Workflow

```bash
# Deploy with R2 logging enabled
pnpm deploy

# Set production secret
wrangler secret put ENABLE_R2_LOGGING
# Enter: true

# Trigger workflow manually
curl https://your-worker.workers.dev/test-scraper

# View logs
wrangler r2 object list contribot-workflow-logs
```

---

## 🎯 Summary

- **Created**: R2 bucket `contribot-workflow-logs`
- **Binding**: `WORKFLOW_LOGS` in `wrangler.jsonc`
- **Toggle**: `ENABLE_R2_LOGGING` environment variable
- **Format**: JSONL files organized by date
- **Access**: Cloudflare Dashboard or Wrangler CLI
- **Failsafe**: R2 failures don't break workflows

Your workflow logs are now persistent and accessible! 🎉

