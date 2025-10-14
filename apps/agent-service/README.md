# Agent Service

AI agent service for Contribot using Cloudflare Agents SDK and Durable Objects.

## Overview

The agent service manages per-user AI agents that:
- Maintain persistent conversation state
- Integrate with GitHub via MCP (Model Context Protocol)
- Execute GitHub actions (fork, branch, comment, PR)
- Provide context-aware recommendations

## Architecture

- **Durable Object**: `ContribotAgent` - One instance per user
- **MCP Client**: Remote HTTP client to GitHub MCP Server (`api.githubcopilot.com`)
- **AI Model**: Llama 3.3 70B (via Workers AI)
- **State**: Conversation history + current context stored in DO

## Endpoints

All endpoints are proxied through `/agent/:userId/*` in the user-application.

### Agent Management
- `POST /initialize` - Initialize agent for user
- `GET /state` - Get current agent state

### Chat
- `POST /chat` - Send message to agent
  - Request: `{ message: string }`
  - Response: `{ response: string, suggestedActions?: Array<{ action: string, label: string }> }`

### GitHub Actions
- `POST /fork` - Fork repository
  - Request: `{ owner: string, repo: string }`
- `POST /branch` - Create branch
  - Request: `{ owner: string, repo: string, branchName: string, fromBranch?: string }`
- `POST /comment` - Comment on issue
  - Request: `{ owner: string, repo: string, issueNumber: number, comment: string }`
- `POST /pr` - Create pull request
  - Request: `{ owner: string, repo: string, title: string, head: string, base: string, body?: string }`
- `GET /repos` - List user's repositories

## Development

```bash
pnpm install
pnpm dev
```

## Deployment

```bash
pnpm deploy
```

## Environment Variables

Required secrets (set via `wrangler secret put`):
- `BETTER_AUTH_SECRET` - Better-auth secret
- `GITHUB_CLIENT_ID` - GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth app client secret

Environment variables (in wrangler.jsonc):
- `GITHUB_MCP_SERVER_URL` - GitHub MCP server URL (default: `https://api.githubcopilot.com/mcp/`)

## Bindings

- `DB` - D1 database (contribot)
- `AI` - Workers AI binding
- `AGENT_DO` - Durable Object namespace

## MCP Integration

The service uses the official GitHub MCP Server hosted by GitHub. GitHub tokens are retrieved from better-auth's `auth_account` table.

Required GitHub OAuth scopes:
- `read:user`
- `user:email`
- `repo` (for fork, branch, PR operations)
- `workflow` (for GitHub Actions)

## Notes

- Each user gets one Durable Object instance (keyed by user ID)
- Conversation history is limited to last 10 messages for context
- Agent state is automatically persisted to Durable Object storage
- MCP client handles JSON response parsing from GitHub's API

