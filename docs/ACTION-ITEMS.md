# Action Items Required

## 📋 Your To-Do List

### 1. Database Schema Migration ⚠️ CRITICAL

**File to review**: `docs/user-preferences-schema.md`

Add the following columns to the `auth_user` table via Drizzle migration:

```typescript
// In packages/data-ops/src/drizzle/auth-schema.ts
export const auth_user = sqliteTable("auth_user", {
  // ... existing fields ...
  
  preferredLanguages: text("preferred_languages", { mode: "json" })
    .$type<string[]>()
    .default([]),
  difficultyPreference: integer("difficulty_preference")
    .default(3),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
    .notNull()
    .default(false),
  onboardedAt: integer("onboarded_at", { mode: "timestamp_ms" }),
});
```

**Steps**:
1. Update `auth-schema.ts` with above fields
2. Run: `pnpm drizzle-kit generate` (in `packages/data-ops`)
3. Run: `pnpm drizzle-kit migrate` (apply to local D1)
4. Deploy migration to production D1

---

### 2. Install Agent Service Dependencies

The agent-service requires the Cloudflare Agents SDK (currently in alpha):

```bash
cd apps/agent-service
pnpm install agents@alpha
pnpm install
```

If the `agents` package is not available, you may need to wait for the public release or request alpha access from Cloudflare.

**Alternative**: If `agents` SDK is not available, the Durable Object implementation can work standalone without the SDK decorators. The core functionality is already implemented.

---

### 3. Cloudflare Dashboard - GitHub OAuth App

**Action**: Update your GitHub OAuth App scopes

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Find your OAuth App (used with better-auth)
3. Edit the app and ensure these scopes are requested:
   - ✅ `read:user`
   - ✅ `user:email`
   - ✅ `repo` (REQUIRED for fork, branch, PR)
   - ✅ `workflow` (REQUIRED for GitHub Actions)

4. Users will need to re-authorize the app to grant new scopes

**Note**: When users next sign in, they'll see a new permission request for repo and workflow access.

---

### 4. Cloudflare Dashboard - Durable Object Migration

**Service**: `contribot-agent-service`

The agent-service uses Durable Objects. After first deployment, you need to:

1. Deploy agent-service: `pnpm deploy:agent-service`
2. Go to Cloudflare Dashboard → Workers & Pages → contribot-agent-service
3. Navigate to **Settings → Durable Objects**
4. Ensure `ContribotAgent` class is registered
5. Note: First deployment will auto-create the DO namespace

---

### 5. Cloudflare Dashboard - Service Bindings

**Service**: `contribot` (user-application)

The user-application needs a service binding to agent-service.

1. Go to Cloudflare Dashboard → Workers & Pages → contribot
2. Navigate to **Settings → Bindings**
3. Click **Add** → **Service Binding**
   - Variable name: `AGENT_SERVICE`
   - Service: `contribot-agent-service`
   - Environment: `production`

**Note**: This is already configured in `wrangler.jsonc` for local development. Dashboard binding ensures it works in production.

---

### 6. Cloudflare Dashboard - Secrets

**Service**: `contribot-agent-service`

Set the following secrets via `wrangler secret put` or dashboard:

```bash
cd apps/agent-service

# Set secrets
wrangler secret put BETTER_AUTH_SECRET       # Same as user-application
wrangler secret put GITHUB_CLIENT_ID         # Same as user-application  
wrangler secret put GITHUB_CLIENT_SECRET     # Same as user-application
```

These secrets are needed for the agent to retrieve user GitHub tokens from the database.

---

### 7. Rebuild data-ops Package

After adding the database schema changes:

```bash
pnpm run build:data-ops
```

This ensures all services have the latest types and queries.

---

### 8. Deploy Services

Deploy in this order:

```bash
# 1. Data operations (if schema changed)
pnpm run build:data-ops

# 2. Agent service (new)
pnpm deploy:agent-service

# 3. User application (updated)
pnpm deploy:user-application

# 4. Data service (unchanged, but redeploy if needed)
pnpm deploy:data-service

# 5. Scraper service (unchanged, but redeploy if needed)
pnpm deploy:scraper-service
```

---

### 9. Test Agent Initialization

After deployment, test the agent flow:

1. Sign in to the app
2. Complete onboarding (select languages, difficulty)
3. Navigate to `/app`
4. Chat should auto-initialize
5. Try sending a message
6. Check Cloudflare logs for any errors

**Debug**: If agent fails to initialize:
- Check D1 has user preferences columns
- Check service binding is configured
- Check secrets are set
- Check Durable Object is created

---

### 10. GitHub MCP Server Access (IMPORTANT)

The agent service uses GitHub's hosted MCP server at `https://api.githubcopilot.com/mcp/`.

**Requirements**:
- This is a **remote MCP server** hosted by GitHub
- According to GitHub MCP documentation, it may require:
  - GitHub Copilot license (for some endpoints)
  - Or OAuth flow via GitHub App

**Testing**:
1. After deployment, test fork/branch operations
2. If you get 401/403 errors from MCP server:
   - Verify your GitHub OAuth app has correct scopes
   - Check if GitHub Copilot subscription is required
   - Review [GitHub MCP docs](https://github.com/github/github-mcp-server) for latest requirements

**Fallback**: If remote MCP server requires Copilot license you don't have, you can:
- Self-host the GitHub MCP server (see their docs for Docker deployment)
- Update `GITHUB_MCP_SERVER_URL` in agent-service wrangler.jsonc to your self-hosted URL

---

## ✅ Verification Checklist

After completing above steps:

- [ ] Database migration applied (auth_user has new columns)
- [ ] GitHub OAuth app updated with repo + workflow scopes
- [ ] agent-service deployed successfully
- [ ] Durable Object namespace created
- [ ] Service binding configured (user-app → agent-service)
- [ ] Secrets set for agent-service
- [ ] data-ops rebuilt
- [ ] All services deployed
- [ ] Onboarding flow works
- [ ] Chat initializes without errors
- [ ] Can send messages to agent
- [ ] Agent responses appear in chat

---

## 🐛 Troubleshooting

### Agent fails to initialize
- Check browser console for errors
- Check Cloudflare logs: `wrangler tail contribot-agent-service`
- Verify service binding exists

### "GitHub tokens not found"
- User needs to sign out and sign in again to grant new OAuth scopes
- Check `auth_account` table has `access_token` for GitHub provider

### MCP calls fail (401/403)
- Verify GitHub OAuth scopes include `repo` and `workflow`
- Check if GitHub MCP server requires Copilot license
- Consider self-hosting MCP server if needed

### Database errors
- Ensure migration was applied: `pnpm drizzle-kit push` in data-ops
- Check D1 schema: `wrangler d1 execute contribot --command "PRAGMA table_info(auth_user)"`

---

## 📞 Support

If you encounter issues:
1. Check Cloudflare logs: `wrangler tail <service-name>`
2. Check browser console for frontend errors
3. Review `docs/phase-2-4-implementation-summary.md` for architecture details
4. Review individual service READMEs:
   - `apps/agent-service/README.md`
   - `apps/data-service/README.md`
   - `apps/scraper-service/README.md`

