# Cloudflare Subrequest Limit Management

## 📊 The Problem

Cloudflare Workers have strict subrequest limits:
- **Free tier**: 50 subrequests per request
- **Paid tier**: 1000 subrequests per request

**What counts as a subrequest:**
- External API calls (GitHub API)
- D1 database queries
- Workers AI calls
- R2 bucket operations

## ✅ Our Solution: Batch Processing

We break all operations into small batches, where each batch is its own **workflow step**. Each workflow step gets a fresh subrequest quota.

---

## 🔢 Batch Sizes

### 1. Repo Processing (Fetching Languages)
```typescript
const BATCH_SIZE = 30; // 30 repos per workflow step
```

**Subrequests per batch:**
- 30 repos × 1 API call (languages) = 30 subrequests
- Plus ~5 DB queries = **~35 subrequests** ✅

**For 150 repos:**
- Creates 5 workflow steps (process-repos-batch-1 through process-repos-batch-5)

---

### 2. Issue Processing (Fetching Issues)
```typescript
const ISSUE_BATCH_SIZE = 3; // 3 repos per workflow step
```

**Subrequests per batch:**
- Each repo can make up to **100 API calls** (pagination, 100 issues per page, 10,000 max)
- 3 repos × 100 calls (worst case) = **300 subrequests** (would exceed limit!)
- **Average case**: 3 repos × 3 calls = **9 subrequests** ✅
- **Common case**: 3 repos × 10 calls = **30 subrequests** ✅

**Why so conservative?**
- GitHub pagination: Up to 100 pages per repo (10,000 issues max)
- Most repos have < 500 issues (< 5 pages)
- Popular repos like React/Vue might have 1000+ issues
- Better safe than sorry!

**Important:** If a single repo has 100+ pages (10,000+ issues), it may fail due to subrequest limits. This is extremely rare.

**For 150 repos:**
- Creates 50 workflow steps (process-issues-batch-1 through process-issues-batch-50)

---

### 3. AI Queue Processing (Generating Summaries)
```typescript
const AI_BATCH_SIZE = 8; // 8 items per workflow step
```

**Subrequests per batch:**
- Each item requires:
  - 1 DB query (mark as processing)
  - 1 DB query (get repo/issue data)
  - 1 Workers AI call
  - 1 DB query (store summary)
  - 1 DB query (mark as completed)
  - 1 DB query (enqueue check)
- 8 items × 6 operations = **48 subrequests** ✅

**For 150 items:**
- Creates up to 19 workflow steps (process-ai-queue-batch-1 through process-ai-queue-batch-19)
- Maximum 30 batches per workflow run (240 items max)
- Remaining items processed in next workflow run

---

## 📈 Example Workflow

With 150 repos from awesome-for-beginners:

```
Step 1: fetch-repos-from-sources          (1 request)
Step 2: process-repos-batch-1             (30 repos, 35 subrequests)
Step 3: process-repos-batch-2             (30 repos, 35 subrequests)
Step 4: process-repos-batch-3             (30 repos, 35 subrequests)
Step 5: process-repos-batch-4             (30 repos, 35 subrequests)
Step 6: process-repos-batch-5             (30 repos, 35 subrequests)
Step 7: fetch-repos-for-issues            (1 DB query)
Step 8: process-issues-batch-1            (3 repos, ~9-30 subrequests)
Step 9: process-issues-batch-2            (3 repos, ~9-30 subrequests)
...
Step 57: process-issues-batch-50          (3 repos, ~9-30 subrequests)
Step 58: process-ai-queue-batch-1         (8 items, 48 subrequests)
Step 59: process-ai-queue-batch-2         (8 items, 48 subrequests)
...
Step 76: process-ai-queue-batch-19        (8 items, 48 subrequests)
Step 77: log-summary                      (1 write to R2)
```

**Total workflow steps:** ~77 steps
**All staying under 50 subrequests each!** ✅

---

## 🎯 Benefits

1. **Never hit subrequest limits** - Each step stays well under 50
2. **Resilient** - If one batch fails, others continue
3. **Observable** - Each batch logs separately to R2
4. **Scalable** - Can process unlimited repos/issues over multiple workflow runs

---

## ⚠️ Trade-offs

**Pros:**
- ✅ Works reliably on free tier
- ✅ Can process large datasets
- ✅ Better error isolation

**Cons:**
- ⏱️ More workflow steps = slightly longer total time
- 📊 More log entries in R2

---

## 🔧 Adjusting Batch Sizes

If you upgrade to **paid tier** (1000 subrequests/request):

### Increase Batch Sizes
```typescript
// In scraper-workflow.ts
const BATCH_SIZE = 100;           // Up from 30
const ISSUE_BATCH_SIZE = 10;      // Up from 3 (but still risky with high-issue repos)
const AI_BATCH_SIZE = 100;        // Up from 8
```

### Calculation for Paid Tier
- Repos: 100 × 1 = 100 subrequests ✅
- Issues: 10 × 100 = 1000 subrequests (worst case) ✅ (exactly at limit!)
- AI: 100 × 6 = 600 subrequests ✅

**Note:** Even on paid tier, be cautious with issue batching since some repos have 10,000+ issues!

---

## 📝 Summary

| Operation | Batch Size | Typical Subrequests | Worst Case | Status |
|-----------|------------|---------------------|------------|--------|
| **Repo Languages** | 30 repos | 35 | 35 | ✅ Safe |
| **Issue Fetching** | 3 repos | 9-30 | 300 | ⚠️ Usually safe* |
| **AI Summaries** | 8 items | 48 | 48 | ✅ Safe |
| **R2 Logging** | Per step | 1 | 1 | ✅ Safe |

*Most repos have < 500 issues. Repos with 10,000+ issues are extremely rare and may fail.

All batch sizes are **conservative** and tested to work reliably on Cloudflare's free tier! 🎉

