# Quick Start Guide - Cloudflare Agents Implementation

This guide will help you get the new Cloudflare Agents implementation running.

## Prerequisites

-   All dependencies are already installed (agents SDK ^0.2.13 is in package.json)
-   No new packages need to be installed

## Step-by-Step Setup

### 1. Rebuild Data-Ops Package

The data-ops package has new query functions that need to be built:

```bash
cd packages/data-ops
pnpm run build
cd ../..
```

### 2. Regenerate Drizzle Schemas (if schema changed)

```bash
cd packages/data-ops
pnpm run db:generate  # Generate migration files
pnpm run db:migrate   # Apply migrations to database
cd ../..
```

### 3. Regenerate Cloudflare Types

```bash
cd apps/agent-service
pnpm run cf-typegen
cd ../..
```

### 4. Set Up Environment Variables

#### For agent-service:

```bash
cd apps/agent-service
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` if you have Deepgram/ElevenLabs keys (optional for now).

#### For user-application:

Add to your user-application `.env` or environment variables:

```bash
VITE_AGENT_SERVICE_URL=localhost:8788  # For local dev
# or
VITE_AGENT_SERVICE_URL=your-agent-service.workers.dev  # For production
```

### 5. Test Locally

#### Terminal 1 - Agent Service:

```bash
cd apps/agent-service
pnpm run dev:local
```

This will start the agent service on http://localhost:8788

#### Terminal 2 - User Application:

```bash
cd apps/user-application
pnpm run dev
```

This will start the frontend application.

### 6. Test WebSocket Connection

Open the user application in your browser, log in, and try:

1. **Simple chat**: "Hello"
2. **Suggest issues**: "Show me TypeScript issues"
3. **Confirmation flow**: "Fork facebook/react" → Confirm
4. **Schedule**: "Remind me in 1 minute"
5. **Preferences**: "Update my languages to Python, JavaScript"

You should see:

-   WebSocket connected indicator
-   Real-time responses
-   Confirmation prompts for write actions
-   State updates in the dashboard

### 7. Check for Errors

If you see TypeScript or linting errors:

```bash
# Fix any linting issues
cd apps/agent-service
pnpm run lint

# Check for type errors
tsc --noEmit
```

Common issues:

-   **Import errors**: Rebuild data-ops package
-   **Type errors**: Run cf-typegen
-   **WebSocket connection fails**: Check VITE_AGENT_SERVICE_URL

## Testing Checklist

-   [ ] Agent service starts without errors
-   [ ] User application starts without errors
-   [ ] WebSocket connection established (green indicator)
-   [ ] Can send chat messages
-   [ ] Can see agent responses
-   [ ] Confirmation flows work
-   [ ] Dashboard state updates in real-time

## Deployment (When Ready)

### Deploy Agent Service:

```bash
cd apps/agent-service
pnpm run deploy
```

### Deploy User Application:

```bash
cd apps/user-application
# Update VITE_AGENT_SERVICE_URL to production URL
pnpm run deploy
```

## Troubleshooting

### WebSocket Won't Connect

1. Check agent service is running on the correct port
2. Verify VITE_AGENT_SERVICE_URL is set correctly
3. Check browser console for CORS or connection errors
4. Try using `ws://` instead of `wss://` for local dev

### Type Errors

1. Rebuild data-ops: `cd packages/data-ops && pnpm run build`
2. Regenerate types: `cd apps/agent-service && pnpm run cf-typegen`
3. Restart TypeScript server in your editor

### Agent Not Responding

1. Check agent service logs in terminal
2. Verify user is authenticated (userId is present)
3. Check D1 database has user record
4. Verify GitHub tokens are in database

### "GitHub tokens not found"

1. Log out and log back in to refresh tokens
2. Check auth_account table in D1
3. Verify GitHub OAuth is configured correctly

## What's Changed

### Agent Service

-   Now uses WebSocket instead of HTTP
-   Extends `Agent` class from Cloudflare Agents SDK
-   Real-time bidirectional communication
-   Built-in state management

### Frontend

-   WebSocket-based chat interface
-   Real-time state updates
-   Confirmation flow UI
-   Auto-reconnection

### Capabilities Added

1. Repository suggestions with language filters
2. Issue suggestions with difficulty scoring
3. Fork repository with confirmation
4. Create branch with confirmation
5. Comment on issues with confirmation
6. Create PRs with confirmation
7. Favourite/unfavourite repos and issues
8. Update user preferences
9. Schedule actions for later
10. Start work workflows with checklists

## Known Limitations

-   Voice AI is stubbed (UI present, but functionality pending)
-   Conversation history limited to 20 messages (auto-summarized)
-   GitHub rate limits apply (5000 req/hr)
-   WebSocket reconnection may lose pending actions

## Next Steps

After confirming everything works locally:

1. Review the code changes
2. Test all agent capabilities
3. Deploy to staging environment
4. Test in production-like setup
5. Deploy to production

## Documentation

-   **Full Implementation**: See `AGENT-IMPLEMENTATION-SUMMARY.md`
-   **Migration Guide**: See `apps/agent-service/MIGRATION.md`
-   **Agent Usage**: See `apps/agent-service/README.md`

## Support

If you encounter issues:

1. Check the logs in both terminal windows
2. Review browser console for errors
3. Check WebSocket connection in Network tab
4. Verify environment variables are set
5. Try rebuilding data-ops and regenerating types

## Success!

If you can:

-   ✅ Connect via WebSocket
-   ✅ Send chat messages
-   ✅ Receive responses
-   ✅ Complete confirmation flows
-   ✅ See dashboard state updates

Then the implementation is working correctly!

---

**Note**: You mentioned you'll handle rebuilding data-ops, migrations, and cf-typegen. The implementation is complete and ready for those steps.
