# Setup Guide

This guide provides complete instructions for setting up Contribot for local development and production deployment on Cloudflare.

## Prerequisites

### Required Software

-   **Node.js**: Version 18.x or higher
-   **pnpm**: Version 10.14.0 or higher (specified in package.json)
-   **Git**: For version control
-   **Wrangler CLI**: Cloudflare's command-line tool (installed via pnpm)

### Required Accounts

-   **GitHub Account**: For OAuth authentication and API access
-   **Cloudflare Account**: With Workers paid plan (required for Durable Objects)

### Installing pnpm

```bash
npm install -g pnpm@10.14.0
```

Verify installation:

```bash
pnpm --version
```

## Cloudflare Account Setup

### 1. Account Requirements

Contribot requires a Cloudflare Workers Paid plan ($5/month minimum) due to:

-   Durable Objects usage
-   Workers AI inference
-   Queue operations
-   Increased subrequest limits

### 2. Create Required Services

#### D1 Database

Create a D1 database named `contribot`:

```bash
npx wrangler d1 create contribot
```

Note the database ID from the output. You'll need to update this in all `wrangler.jsonc` files:

-   `apps/user-application/wrangler.jsonc`
-   `apps/agent-service/wrangler.jsonc`
-   `apps/data-service/wrangler.jsonc`
-   `apps/scraper-service/wrangler.jsonc`

#### Queues

Create the processing queue:

```bash
npx wrangler queues create processing-queue
```

Create the dead letter queue:

```bash
npx wrangler queues create processing-dlq
```

#### R2 Buckets

Create R2 buckets for workflow logs:

```bash
npx wrangler r2 bucket create contribot-workflow-logs
npx wrangler r2 bucket create contribot-workflow-logs-preview
```

### 3. Configure Workers AI

Workers AI is automatically available on paid plans. No additional setup required, but verify access:

```bash
npx wrangler ai models list
```

Confirm that `@cf/meta/llama-3.3-70b-instruct-fp8-fast` is available.

## GitHub OAuth Application

### 1. Create OAuth App

Navigate to GitHub Settings → Developer settings → OAuth Apps → New OAuth App

**Application Details:**

-   **Application name**: Contribot (or your preferred name)
-   **Homepage URL**: `http://localhost:5173` (for development)
-   **Authorization callback URL**: `http://localhost:5173/api/auth/callback/github`

For production, create a separate OAuth app with your production URLs.

### 2. Required Scopes

Configure the OAuth app to request these scopes:

-   `read:user` - Read user profile information
-   `user:email` - Access user email addresses
-   `repo` - Full control of repositories (required for fork, branch, PR operations)
-   `workflow` - Update GitHub Action workflows

These scopes are configured in `packages/data-ops/src/auth/setup.ts` and will be requested during user authorization.

### 3. Note Credentials

After creating the app, note:

-   **Client ID**
-   **Client Secret**

You'll need these for environment configuration.

## Local Development Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd contribot
```

### 2. Install Dependencies

```bash
pnpm install
```

This installs dependencies for all workspace packages.

### 3. Build Data Operations Package

The data-ops package must be built before other services can use it:

```bash
pnpm run build:data-ops
```

This compiles TypeScript and generates type definitions used across all services.

### 4. Configure Environment Variables

#### User Application

Create `.dev.vars` in `apps/user-application/`:

```bash
BETTER_AUTH_SECRET=<generate-random-string>
GITHUB_CLIENT_ID=<your-github-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-client-secret>
BETTER_AUTH_URL=http://localhost:5173
```

Generate a secure random string for `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 32
```

#### Agent Service

Create `.dev.vars` in `apps/agent-service/`:

```bash
# Optional: Voice AI credentials (not yet implemented)
DEEPGRAM_API_KEY=
ELEVENLABS_API_KEY=
```

Agent service primarily uses bindings defined in `wrangler.jsonc`, so minimal environment variables are needed.

#### Data Service and Scraper Service

These services use bindings exclusively and don't require `.dev.vars` files for local development.

### 5. Apply Database Migrations

Initialize the D1 database with the required schema:

```bash
cd packages/data-ops
pnpm run db:generate
pnpm run db:migrate
cd ../..
```

This creates all required tables:

-   Authentication tables (auth_user, auth_session, auth_account, auth_verification)
-   Repository and issue tables
-   AI summaries table
-   User favourites table

### 6. Generate Cloudflare Types

Generate TypeScript types for Cloudflare bindings:

```bash
cd apps/agent-service
pnpm run cf-typegen
cd ../..
```

Repeat for other services if needed.

## Running Services Locally

Contribot runs as four separate services that work together. You'll need four terminal windows.

### Terminal 1: User Application

```bash
cd apps/user-application
pnpm run dev
```

This starts:

-   Vite development server on `http://localhost:5173`
-   Cloudflare Pages server for SSR and API routes

The application will be accessible at `http://localhost:5173`.

### Terminal 2: Agent Service

```bash
cd apps/agent-service
pnpm run dev:local
```

This starts:

-   Workers development server on `http://localhost:8788`
-   WebSocket endpoint for agent communication
-   Durable Objects with local persistence

The `dev:local` script uses `--local` flag for full local execution with `.wrangler/state` persistence.

### Terminal 3: Data Service

```bash
cd apps/data-service
pnpm run dev
```

This starts:

-   Queue consumer for processing queue
-   Local queue bindings for development

The service processes queued repositories and issues in the background.

### Terminal 4: Scraper Service

```bash
cd apps/scraper-service
pnpm run dev
```

This starts:

-   Cron-triggered scraper (manually triggered in dev mode)
-   Repository discovery service

To manually trigger the scraper in development:

```bash
curl http://localhost:8787/
```

### Verify Services

Check that all services are running:

1. **User Application**: Visit `http://localhost:5173`, should show landing page
2. **Agent Service**: WebSocket endpoint at `ws://localhost:8788/agent/<userId>`
3. **Data Service**: Check logs for "Queue consumer ready"
4. **Scraper Service**: Check logs for successful startup

## Testing the Application

### 1. Authentication Flow

1. Navigate to `http://localhost:5173`
2. Click "Sign in with GitHub"
3. Authorize the application (first time only)
4. Should redirect to onboarding flow

### 2. Onboarding

1. Select programming languages or click "Scan GitHub"
2. Adjust difficulty slider
3. Click "Continue"
4. Should redirect to `/app` with split-view interface

### 3. Chat Interface

Test the agent connection:

```
User: Hello
Agent: <Should respond with greeting>

User: Show me TypeScript issues
Agent: <Should list TypeScript issues with language filter>

User: Fork facebook/react
Agent: <Should ask for confirmation>

User: Yes
Agent: <Should execute fork or inform of existing fork>
```

### 4. Dashboard

1. Click "Issues" tab - should load recommended issues
2. Click an issue - should show issue details
3. Click "Get Started" - should trigger fork/branch workflow
4. Click "Settings" - should show preferences (read-only currently)

## Production Deployment

### 1. Update Database IDs

Ensure all `wrangler.jsonc` files reference your production D1 database ID.

### 2. Set Production Secrets

For each service that requires secrets:

```bash
# User Application
cd apps/user-application
echo "<your-secret>" | npx wrangler secret put BETTER_AUTH_SECRET
echo "<your-client-id>" | npx wrangler secret put GITHUB_CLIENT_ID
echo "<your-client-secret>" | npx wrangler secret put GITHUB_CLIENT_SECRET

# Agent Service (if using voice features)
cd apps/agent-service
echo "<deepgram-key>" | npx wrangler secret put DEEPGRAM_API_KEY
```

### 3. Update OAuth Callback URLs

In your GitHub OAuth app settings, add production callback URL:

-   `https://your-domain.com/api/auth/callback/github`

Update `BETTER_AUTH_URL` in production environment to match your domain.

### 4. Deploy Services

Deploy in this order:

```bash
# 1. Deploy agent service first
pnpm run deploy:agent-service

# 2. Deploy data service
pnpm run deploy:data-service

# 3. Deploy scraper service
pnpm run deploy:scraper-service

# 4. Deploy user application last
pnpm run deploy:user-application
```

Each deployment script:

-   Rebuilds data-ops package
-   Compiles TypeScript
-   Bundles assets
-   Deploys to Cloudflare

### 5. Apply Database Migrations to Production

```bash
cd packages/data-ops
npx wrangler d1 execute contribot --remote --file=./src/drizzle/migrations/0000_migration.sql
```

Replace `0000_migration.sql` with your actual migration file names, in order.

### 6. Verify Deployment

1. Visit your production URL
2. Test authentication flow
3. Complete onboarding
4. Send test chat messages
5. Monitor logs: `npx wrangler tail <service-name>`

## Configuration Reference

### Service Bindings

The user application connects to the agent service via service binding defined in `apps/user-application/wrangler.jsonc`:

```json
"services": [
  {
    "binding": "AGENT_SERVICE",
    "service": "contribot-agent-service"
  }
]
```

This binding is used in `src/routes/api/agent.$.tsx` to proxy chat requests.

### Database Bindings

All services use the same D1 database binding:

```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "contribot",
    "database_id": "<your-database-id>",
    "remote": true
  }
]
```

### Workers AI Binding

Agent and data services use Workers AI:

```json
"ai": {
  "binding": "AI",
  "remote": true
}
```

Access via `env.AI.run()` in code.

### Durable Objects

Agent service defines the ContribotAgent Durable Object:

```json
"durable_objects": {
  "bindings": [
    {
      "name": "ContribotAgent",
      "class_name": "ContribotAgent"
    }
  ]
},
"migrations": [
  {
    "tag": "v1",
    "new_sqlite_classes": ["ContribotAgent"]
  }
]
```

### Queue Bindings

Data service consumes the processing queue:

```json
"queues": {
  "producers": [
    {
      "binding": "PROCESSING_QUEUE",
      "queue": "processing-queue"
    }
  ],
  "consumers": [
    {
      "queue": "processing-queue",
      "max_batch_size": 10,
      "max_retries": 3,
      "dead_letter_queue": "processing-dlq"
    }
  ]
}
```

Scraper service produces to the same queue.

### Cron Triggers

Scraper service runs on a schedule:

```json
"triggers": {
  "crons": ["0 */12 * * *"]
}
```

This translates to: every 12 hours at minute 0.

## Troubleshooting

### Build Errors

**Error**: `Cannot find module '@repo/data-ops'`

**Solution**: Build the data-ops package:

```bash
cd packages/data-ops
pnpm run build
```

**Error**: `Property 'AI' does not exist on type 'Env'`

**Solution**: Regenerate Cloudflare types:

```bash
cd apps/agent-service
pnpm run cf-typegen
```

### Runtime Errors

**Error**: `WebSocket connection failed`

**Cause**: Agent service not running or incorrect URL

**Solution**:

1. Verify agent service is running on port 8788
2. Check that user application can reach the agent service
3. For local dev, ensure using `ws://` not `wss://`

**Error**: `GitHub tokens not found`

**Cause**: User authentication incomplete or tokens not stored

**Solution**:

1. Log out and log back in
2. Check `auth_account` table in D1 for `accessToken`
3. Verify GitHub OAuth scopes are correct

**Error**: `D1_ERROR: no such table: repos`

**Cause**: Database migrations not applied

**Solution**:

```bash
cd packages/data-ops
pnpm run db:migrate
```

### Development Workflow Issues

**Issue**: Changes to data-ops not reflected in services

**Solution**: Rebuild data-ops and restart services:

```bash
pnpm run build:data-ops
# Restart all service terminals
```

**Issue**: TypeScript errors after schema changes

**Solution**:

1. Regenerate Drizzle migrations: `pnpm run db:generate`
2. Rebuild data-ops: `pnpm run build:data-ops`
3. Restart TypeScript server in your editor

**Issue**: Durable Object state persists old data

**Solution**: Delete local state:

```bash
rm -rf apps/agent-service/.wrangler/state
```

## Monitoring and Debugging

### Local Logs

All services output logs to their respective terminal windows. Look for:

-   HTTP requests and responses
-   WebSocket connection events
-   Queue message processing
-   AI inference calls
-   Database queries (with `?debug=true` in connection string)

### Production Logs

Use Wrangler to tail production logs:

```bash
# Agent service logs
npx wrangler tail contribot-agent-service

# Data service logs
npx wrangler tail contribot-data-service

# Scraper service logs
npx wrangler tail contribot-scraper-service

# User application logs
npx wrangler tail contribot
```

### Debugging Durable Objects

To inspect Durable Object state:

```bash
# List all Durable Object IDs
npx wrangler d1 execute contribot --command "SELECT * FROM _cf_KV"

# For specific user's agent state
# Access via WebSocket or add a debug endpoint
```

### Database Inspection

Query D1 directly:

```bash
# Local database
npx wrangler d1 execute contribot --local --command "SELECT COUNT(*) FROM repos"

# Production database
npx wrangler d1 execute contribot --remote --command "SELECT COUNT(*) FROM repos"
```

### Queue Monitoring

Check queue depth and failed messages:

```bash
npx wrangler queues list
npx wrangler queues consumer <queue-name>
```

## Performance Optimization

### Local Development

-   Use `--local` flag for Durable Objects to avoid remote calls
-   Enable D1 persistence: `--persist-to .wrangler/state`
-   Reduce AI context window during testing to minimize latency

### Production

-   Enable observability in `wrangler.jsonc` (already configured)
-   Monitor Workers AI token usage in Cloudflare dashboard
-   Set appropriate queue batch sizes (currently 10)
-   Consider implementing conversation history archival to D1

## Security Considerations

### Local Development

-   Never commit `.dev.vars` files
-   Use separate OAuth apps for development and production
-   Restrict development OAuth callback to localhost

### Production

-   Rotate GitHub OAuth secrets periodically
-   Use strong random strings for `BETTER_AUTH_SECRET`
-   Enable Cloudflare WAF rules for frontend
-   Monitor for unusual GitHub API usage patterns
-   Implement rate limiting on agent endpoints if needed

## Updating Dependencies

### Updating pnpm Packages

```bash
# Update all dependencies
pnpm update

# Update specific package
pnpm update <package-name>

# Rebuild data-ops after updates
pnpm run build:data-ops
```

### Updating Wrangler

```bash
pnpm update wrangler -g
```

### Schema Migrations

When updating database schema:

1. Edit schema files in `packages/data-ops/src/drizzle/`
2. Generate migration: `pnpm run db:generate`
3. Review generated SQL in `src/drizzle/migrations/`
4. Apply locally: `pnpm run db:migrate`
5. Test thoroughly
6. Apply to production: `npx wrangler d1 execute contribot --remote --file=<migration.sql>`
7. Rebuild data-ops: `pnpm run build:data-ops`
8. Redeploy all services

## Additional Resources

### Documentation

-   Cloudflare Workers: https://developers.cloudflare.com/workers/
-   Durable Objects: https://developers.cloudflare.com/durable-objects/
-   Workers AI: https://developers.cloudflare.com/workers-ai/
-   D1 Database: https://developers.cloudflare.com/d1/
-   Queues: https://developers.cloudflare.com/queues/

### Project Documentation

-   `README.md` - Project overview and architecture
-   `docs/OVERVIEW.md` - Product vision
-   `docs/IMPLEMENTATION.md` - Implementation details
-   `AGENT-IMPLEMENTATION-SUMMARY.md` - Agent service specifics
-   `apps/agent-service/README.md` - Agent API reference

### Getting Help

1. Check terminal logs for error messages
2. Review Cloudflare dashboard for service status
3. Inspect D1 database for data consistency
4. Test WebSocket connection independently
5. Verify all environment variables are set correctly

## Next Steps

After completing setup:

1. Familiarize yourself with the codebase structure
2. Review the agent capabilities in `apps/agent-service/src/durable-objects/agent.ts`
3. Test all user flows: authentication, onboarding, chat, GitHub actions
4. Explore customization options for your use case
5. Consider implementing additional features from the roadmap

For production deployment, ensure all services are thoroughly tested in a staging environment before going live.
