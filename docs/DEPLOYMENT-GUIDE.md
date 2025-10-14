# Contribot - Deployment Guide

## 🎉 Implementation Complete: Phases 2-5

All code has been implemented for:
- ✅ Phase 2: MCP GitHub Integration Layer
- ✅ Phase 3: Frontend Landing & Onboarding  
- ✅ Phase 4: AI Agent Service with Durable Objects
- ✅ Phase 5: Chat & Dashboard UI

---

## 📁 New Files Created

### Agent Service (New App)
```
apps/agent-service/
├── src/
│   ├── durable-objects/
│   │   └── agent.ts                    # Main ContribotAgent Durable Object
│   ├── mcp/
│   │   └── github-client.ts            # GitHub MCP client wrapper
│   ├── utils/
│   │   └── auth-helpers.ts             # Better-auth token retrieval
│   └── index.ts                        # Entry point (Hono router)
├── package.json
├── wrangler.jsonc
├── tsconfig.json
└── README.md
```

### User Application Updates
```
apps/user-application/
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   └── chat-interface.tsx      # Chat UI component
│   │   └── dashboard/
│   │       └── dashboard-view.tsx      # Dashboard with tabs
│   └── routes/
│       ├── index.tsx                   # New landing page
│       ├── _auth/
│       │   ├── onboarding.tsx          # Onboarding flow
│       │   └── app/
│       │       └── index.tsx           # Main app (split view)
│       └── api/
│           ├── agent.$.tsx             # Agent proxy routes
│           ├── user.preferences.tsx    # User prefs API
│           └── issues.recommended.tsx  # Issue matching API
└── wrangler.jsonc                      # Updated with service binding
```

### Data Operations Updates
```
packages/data-ops/
└── src/
    └── auth/
        └── setup.ts                    # Updated OAuth scopes
```

### Documentation
```
docs/
├── user-preferences-schema.md          # DB schema requirements
├── phase-2-4-implementation-summary.md # Technical implementation details
├── ACTION-ITEMS.md                     # Your to-do list (⚠️ READ THIS)
└── DEPLOYMENT-GUIDE.md                 # This file
```

---

## 🚀 Quick Start

### 1. Review Action Items (REQUIRED)
```bash
cat docs/ACTION-ITEMS.md
```

This file contains ALL the steps you need to complete before deploying.

### 2. Update Database Schema
```bash
# Add user preference fields to auth_user table
# See docs/user-preferences-schema.md for details

cd packages/data-ops
# Edit src/drizzle/auth-schema.ts to add new fields
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### 3. Install Dependencies
```bash
# Root level
pnpm install

# Build data-ops with new schema
pnpm run build:data-ops
```

### 4. Set Environment Variables

**Agent Service**:
```bash
cd apps/agent-service
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

### 5. Deploy Services

```bash
# Deploy agent service first (new)
pnpm deploy:agent-service

# Deploy user application (updated)
pnpm deploy:user-application

# Redeploy other services if needed
pnpm deploy:data-service
pnpm deploy:scraper-service
```

### 6. Configure Cloudflare Dashboard

1. **GitHub OAuth App**: Add `repo` and `workflow` scopes
2. **Service Binding**: Link user-app → agent-service
3. **Durable Objects**: Verify ContribotAgent is registered

See `docs/ACTION-ITEMS.md` for detailed steps.

---

## 🧪 Testing the Implementation

### Test Onboarding Flow
1. Navigate to your deployed app URL
2. Click "Sign in with GitHub"
3. Authorize with new scopes (if prompted)
4. Complete onboarding:
   - Select programming languages
   - Try "Scan GitHub" button
   - Choose difficulty level
5. Should redirect to `/app`

### Test Chat Interface
1. After onboarding, you'll see split view
2. Left side: Chat interface
3. Send a message like "Show me JavaScript issues"
4. Agent should respond with context-aware suggestions
5. Check for suggested action buttons

### Test Dashboard
1. Right side: Dashboard with tabs
2. Click "Issues" tab
3. Should load recommended issues based on your preferences
4. Click an issue to see details
5. "Get Started" button should be visible

### Test Agent Actions
```bash
# Check agent service logs
wrangler tail contribot-agent-service

# Send test requests via chat:
# - "Fork the repository owner/repo"
# - "Create a branch called my-feature"
# - "Comment on issue #123"
```

---

## 🔍 Architecture Overview

### Request Flow
```
User Browser
    ↓
User Application (Cloudflare Pages)
    ↓
/api/agent/* routes
    ↓
Service Binding
    ↓
Agent Service (Worker)
    ↓
ContribotAgent (Durable Object)
    ├─→ Workers AI (Llama 3.3)
    ├─→ GitHub MCP Server (api.githubcopilot.com)
    └─→ D1 Database (user prefs, auth tokens)
```

### Data Flow
1. User completes onboarding → prefs saved to D1
2. User sends chat message → routed to their Durable Object
3. Agent builds context from D1 (user prefs, current issue)
4. Agent calls Workers AI for response
5. Response may include suggested actions
6. User clicks action → agent calls GitHub MCP server
7. MCP server executes GitHub API calls
8. Results returned to user via chat

---

## 📊 Service Responsibilities

### user-application
- Frontend (React + TanStack Router)
- Authentication (better-auth)
- API routes (proxy to agent-service)
- Serving Pages

### agent-service (NEW)
- Per-user AI agents (Durable Objects)
- Conversation state management
- GitHub actions via MCP
- Context-aware AI responses

### data-service
- Queue consumer for repo/issue processing
- AI summarization (repo summaries, issue analysis)
- Database updates

### scraper-service
- Discovery service (find repos/issues)
- Queue producer
- Scheduled runs (cron)

---

## 📈 Performance Considerations

### Durable Objects
- One instance per user (keyed by user ID)
- Persists conversation state
- No cold start for active users
- Hibernation API could be added for cost optimization

### AI Inference
- Llama 3.3 70B on Workers AI
- Max 800 tokens per response
- Context limited to last 10 messages
- Cost: ~$0.01 per 1000 tokens

### MCP Calls
- Remote HTTP calls to GitHub
- Token-based auth (from better-auth)
- Error handling for rate limits
- Consider caching for repeated queries

---

## 🔒 Security Notes

### GitHub Tokens
- Stored in D1 (`auth_account` table)
- Retrieved per-request by agent
- Never exposed to frontend
- Encrypted at rest by Cloudflare

### User Isolation
- Each user gets own Durable Object
- State never shared between users
- Service binding enforces user ID in URL path

### API Authentication
- All API routes check session (via better-auth)
- Unauthenticated requests return 401
- Agent service only accessible via service binding

---

## 💰 Cost Estimation

Based on moderate usage (100 users, 10 chats/day each):

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Workers (agent-service) | 30k requests | $0 (free tier) |
| Durable Objects | 100 objects, 300k requests | ~$5 |
| Workers AI | 3M tokens | ~$30 |
| D1 | 100k reads, 10k writes | $0 (free tier) |
| Pages | Unlimited | $0 |

**Total: ~$35/month** for 100 active users

Scale linearly. Main cost driver is AI inference.

---

## 🐛 Common Issues & Solutions

See `docs/ACTION-ITEMS.md` troubleshooting section for detailed debugging steps.

Quick fixes:
- **Agent fails to init**: Check service binding, verify DO created
- **GitHub token errors**: Re-auth with new OAuth scopes
- **MCP 401 errors**: Check if Copilot license required, consider self-hosting
- **DB errors**: Verify migration applied, check schema

---

## 📚 Additional Resources

- [Cloudflare Agents Docs](https://agents.cloudflare.com)
- [GitHub MCP Server](https://github.com/github/github-mcp-server)
- [Durable Objects Docs](https://developers.cloudflare.com/durable-objects)
- [Workers AI Docs](https://developers.cloudflare.com/workers-ai)

---

## ✅ Pre-Deployment Checklist

Use this before deploying to production:

- [ ] Database schema updated with user preferences fields
- [ ] GitHub OAuth app scopes updated (repo, workflow)
- [ ] All dependencies installed (`pnpm install`)
- [ ] data-ops package rebuilt (`pnpm run build:data-ops`)
- [ ] Secrets set for agent-service
- [ ] Tested locally with `pnpm dev:*` commands
- [ ] Read `docs/ACTION-ITEMS.md` completely
- [ ] Service binding configured in dashboard (if deploying to prod)
- [ ] D1 migrations applied to production database

---

## 🎯 Next Steps After Deployment

1. **Monitor logs**: Use `wrangler tail` to watch for errors
2. **Test all flows**: Onboarding → Chat → GitHub actions
3. **Gather feedback**: The MVP is ready, but UX can be improved
4. **Iterate**:
   - Add progress tracking (track forks, PRs, completed issues)
   - Improve error messages
   - Add streaming chat responses
   - Implement settings UI
   - Add resume OCR

---

## 🎉 You're Ready!

The implementation is complete. Follow the steps in `docs/ACTION-ITEMS.md` to deploy.

If you run into issues, check the troubleshooting sections in both this guide and the action items doc.

Good luck! 🚀

