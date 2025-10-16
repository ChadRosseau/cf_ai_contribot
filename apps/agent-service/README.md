# Contribot Agent Service

AI-powered agent service for Contribot using **Cloudflare Agents SDK** with WebSocket communication.

## Overview

The agent service manages per-user AI agents that help developers make their first open-source contributions. Each agent is a stateful, persistent entity running on Cloudflare's edge network via Durable Objects.

## Architecture

### Core Components

-   **Agent Class**: Extends Cloudflare's `Agent` SDK for agentic behavior
-   **WebSocket Communication**: Real-time bidirectional messaging with clients
-   **GitHub Integration**: GitHubApiClient for repository operations
-   **Data Layer**: Drizzle ORM + D1 for persistent storage
-   **Voice AI**: Stub implementation for Cloudflare Realtime Agents

### Key Features

1. **Conversational AI**: Powered by Workers AI (Llama 3.3)
2. **GitHub Actions**: Fork repos, create branches, comment, open PRs
3. **Data Queries**: Suggest repos and issues based on preferences
4. **Favourites**: Star/unstar repos and issues
5. **Preferences**: Update language and difficulty settings
6. **Scheduling**: Schedule actions using Agent's built-in scheduler
7. **Confirmation Flows**: Multi-step approval for write operations
8. **Dashboard Sync**: Real-time state synchronization via WebSocket
9. **Conversation Summarization**: Automatic summarization for long chats
10. **Voice Input**: Stub for future Cloudflare Realtime integration

## Usage

### Connecting to an Agent

Connect via WebSocket with the user's ID:

```typescript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(
    `${protocol}//agent-service/agent/${userId}?userId=${userId}`
);
```

### Message Protocol

#### Client → Agent

```typescript
// Send a chat message
ws.send(
    JSON.stringify({
        type: "chat",
        message: "Show me TypeScript issues",
    })
);

// Confirm a pending action
ws.send(
    JSON.stringify({
        type: "confirm_action",
        confirmed: true,
    })
);

// Cancel a pending action
ws.send(
    JSON.stringify({
        type: "cancel_action",
    })
);

// Send voice audio
ws.send(
    JSON.stringify({
        type: "voice_audio",
        audio: audioBuffer,
    })
);

// Get current state
ws.send(
    JSON.stringify({
        type: "get_state",
    })
);
```

#### Agent → Client

```typescript
// Connection established
{
  type: "connected",
  state: AgentState
}

// Agent is thinking
{
  type: "thinking"
}

// Message response
{
  type: "message",
  message: {
    role: "assistant",
    content: "Here are some issues...",
    timestamp: 1234567890
  }
}

// State update (dashboard sync)
{
  type: "state_update",
  state: AgentState
}

// Error
{
  type: "error",
  error: "Error message"
}
```

## Agent Capabilities

### 1. Suggest Repos/Issues

```
User: "Show me Python issues"
Agent: [Lists issues with language filter]
```

### 2. Fork Repository

```
User: "Fork facebook/react"
Agent: "I'll fork facebook/react to your account. Should I proceed?"
User: "yes"
Agent: ✅ [Executes fork]
```

### 3. Create Branch

```
User: "Create branch fix-bug-123"
Agent: "I'll create branch fix-bug-123. Should I proceed?"
User: "yes"
Agent: ✅ [Creates branch]
```

### 4. Comment on Issue

```
User: "Comment 'I'd like to work on this!'"
Agent: [Shows confirmation]
User: "yes"
Agent: ✅ [Posts comment]
```

### 5. Open Pull Request

```
User: "Open PR with title 'Fix: Bug 123'"
Agent: [Shows confirmation]
User: "yes"
Agent: ✅ [Creates PR]
```

### 6. Favourite/Unfavourite

```
User: "Favourite issue #123"
Agent: ✅ [Adds to favourites]
```

### 7. Update Preferences

```
User: "Update my languages to JavaScript, TypeScript"
Agent: ✅ [Updates preferences]
```

### 8. Schedule Actions

```
User: "Remind me to check this in 2 hours"
Agent: ✅ [Schedules reminder]
```

### 9. Start Work Workflow

```
User: "Start work on facebook/react issue #123"
Agent: [Shows checklist]
        - [ ] Fork repository
        - [ ] Create branch
        - [ ] Navigate to issue
       Should I proceed?
User: "yes"
Agent: ✅ [Executes workflow]
```

## State Management

### Agent State Structure

```typescript
interface AgentState {
    userId: string;
    conversationHistory: ConversationMessage[];
    conversationSummary?: string;
    dashboardState: DashboardState;
    pendingAction?: PendingAction;
    scheduledTasks: ScheduledTask[];
    createdAt: number;
    updatedAt: number;
}
```

### Dashboard State

```typescript
interface DashboardState {
    currentTab: "overview" | "list" | "issue" | "settings";
    activeIssueId?: number;
    activeRepoId?: number;
    lastAction?: string;
    forkedRepoName?: string;
    branchName?: string;
}
```

## Configuration

### Environment Variables

Required bindings in `wrangler.jsonc`:

```jsonc
{
    "d1_databases": [
        {
            "binding": "DB",
            "database_name": "contribot",
            "database_id": "..."
        }
    ],
    "ai": {
        "binding": "AI"
    },
    "durable_objects": {
        "bindings": [
            {
                "name": "AGENT_DO",
                "class_name": "ContribotAgent"
            }
        ]
    }
}
```

### Deployment

```bash
# Deploy to Cloudflare
pnpm run deploy

# Dev mode (remote)
pnpm run dev

# Dev mode (local with persistence)
pnpm run dev:local
```

## Development

### Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Set up environment:

```bash
cp .dev.vars.example .dev.vars
# Add your secrets
```

3. Run locally:

```bash
pnpm run dev:local
```

### Testing

Connect to the agent via WebSocket from the frontend or a WebSocket client:

```bash
# Using wscat
wscat -c "ws://localhost:8788/agent/user123?userId=user123"
```

## Voice AI Integration

Voice AI capabilities are stubbed for future integration with Cloudflare Realtime Agents. When fully implemented, this will support:

-   Real-time speech-to-text via Deepgram on Workers AI
-   Text-to-speech via Deepgram Aura
-   WebRTC audio streaming via Cloudflare Realtime SFU
-   Turn detection via PipeCat's smart-turn-v2

See `/src/utils/voice-ai.ts` for implementation stubs.

## Error Handling

-   **GitHub API Rate Limits**: Agent informs user and suggests retry later
-   **Network Errors**: Agent reports error and suggests retry
-   **Authentication**: Connection refused if no valid user ID
-   **Invalid Actions**: Clear error messages with guidance

## Best Practices

1. **Always Confirm Write Actions**: The agent requires explicit confirmation for fork, comment, PR, etc.
2. **Use Markdown**: Responses use markdown for better formatting
3. **Checklists**: Multi-step workflows shown as markdown checklists
4. **Clear Communication**: Agent explains what it will do before acting
5. **Error Recovery**: Graceful handling with helpful error messages

## Performance

-   **Edge Execution**: Runs on Cloudflare's edge network (~100ms latency)
-   **State Persistence**: Durable Objects ensure state survives eviction
-   **Conversation Summarization**: Auto-summarizes after 20 messages
-   **WebSocket Reconnection**: Auto-reconnects after 3 seconds

## Security

-   **User Authentication**: Required for all connections
-   **GitHub Token Storage**: Encrypted in D1 database
-   **Rate Limiting**: Respects GitHub API limits
-   **CORS**: Configured for frontend origin

## Monitoring

-   **Console Logging**: Structured logs for debugging
-   **Cloudflare Dashboard**: View metrics and logs
-   **Error Tracking**: Errors sent to client and logged

## Future Enhancements

-   [ ] Full voice AI with Realtime Agents
-   [ ] Multi-language LLM support
-   [ ] Advanced code analysis tools
-   [ ] Integration with CI/CD for PR status
-   [ ] Collaborative agent sessions
-   [ ] Enhanced RAG with Vectorize

## References

-   [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
-   [Cloudflare Agents API Reference](https://developers.cloudflare.com/agents/api-reference/agents-api/)
-   [Cloudflare Realtime Voice AI](https://blog.cloudflare.com/cloudflare-realtime-voice-ai/)
-   [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
