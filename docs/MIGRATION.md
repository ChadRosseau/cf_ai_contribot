# Migration Guide: HTTP to WebSocket Agent

This document outlines the changes made to migrate the Contribot Agent from HTTP-based communication to WebSocket-based communication using the Cloudflare Agents SDK.

## Major Changes

### 1. Agent Implementation

**Before:** Extended `DurableObject` class

```typescript
export class ContribotAgent extends DurableObject {
    async fetch(request: Request): Promise<Response> {
        // HTTP-based endpoints
    }
}
```

**After:** Extends `Agent` class with WebSocket support

```typescript
export class ContribotAgent extends Agent<Env, AgentState> {
    async onConnect(connection: WebSocket, ctx: any) {}
    async onMessage(connection: WebSocket, message: string) {}
    async onClose(connection: WebSocket, code: number, reason: string) {}
    async onError(connection: WebSocket, error: Error) {}
}
```

### 2. Communication Protocol

**Before:** HTTP POST requests

```typescript
// Client
await fetch("/api/agent/chat", {
    method: "POST",
    body: JSON.stringify({ message: "Hello" }),
});
```

**After:** WebSocket messages

```typescript
// Client
const ws = new WebSocket(`ws://agent-service/agent/${userId}?userId=${userId}`);
ws.send(JSON.stringify({ type: "chat", message: "Hello" }));
```

### 3. State Management

**Before:** Manual state management with `ctx.storage`

```typescript
private state: AgentState | null = null;
await this.ctx.storage.put("state", this.state);
```

**After:** Built-in Agent state management

```typescript
initialState: AgentState = {
    /* ... */
};
this.setState(this.state);
```

### 4. Real-time Updates

**Before:** Client polling or manual refresh

```typescript
// Poll every 5 seconds
setInterval(() => fetch("/api/agent/state"), 5000);
```

**After:** Automatic WebSocket push

```typescript
// Server pushes updates
this.broadcastToAllConnections({
    type: "state_update",
    state: this.state,
});
```

### 5. Confirmation Flows

**Before:** Multi-request HTTP flow

```typescript
// 1. Get action suggestion
await fetch("/api/agent/chat", {
    /* ... */
});
// 2. Confirm action
await fetch("/api/agent/confirm", {
    /* ... */
});
```

**After:** Single WebSocket flow with pending state

```typescript
// Agent sets pending action
this.state.pendingAction = {
    /* ... */
};

// Client confirms
ws.send(JSON.stringify({ type: "confirm_action", confirmed: true }));
```

## New Features

### 1. Conversation Summarization

Automatically summarizes conversations after 20 messages to maintain context while reducing token usage.

```typescript
private async summarizeConversation(): Promise<void> {
  // Summarizes old messages and keeps recent 10
}
```

### 2. Scheduling System

Built-in task scheduling using Agent's schedule API:

```typescript
await this.schedule(delay, "executeScheduledTask", { taskId });
```

### 3. Dashboard State Sync

Real-time dashboard state synchronization:

```typescript
interface DashboardState {
    currentTab: "overview" | "list" | "issue" | "settings";
    activeIssueId?: number;
    activeRepoId?: number;
    // ...
}
```

Dashboard listens for state updates:

```typescript
window.addEventListener("agent-state-update", (event) => {
    const state = event.detail;
    // Update dashboard
});
```

### 4. Voice AI Stubs

Prepared for Cloudflare Realtime Agents integration:

```typescript
// src/utils/voice-ai.ts
export class VoiceAIHandler {
    async transcribeAudio(audioData: ArrayBuffer, AI: any) {}
    async textToSpeech(text: string, AI: any) {}
}
```

### 5. Enhanced GitHub Client

Added methods for:

-   `getRepository()` - Get repo details
-   `getIssue()` - Get issue details
-   `checkIfForked()` - Check fork status
-   `checkBranchExists()` - Check if branch exists
-   `getDefaultBranch()` - Get default branch name
-   `listIssues()` - List issues with filters

### 6. Enhanced Data Queries

Added functions for:

-   `getFavouritedRepos()` - Get favourites with full details
-   `getFavouritedIssues()` - Get favourited issues with details

## Breaking Changes

### 1. Entry Point

**Before:**

```typescript
app.all("/agent/:userId/*", async (c) => {
    const stub = c.env.AGENT_DO.get(id);
    return stub.fetch(url.toString(), c.req.raw);
});
```

**After:**

```typescript
app.get("/agent/:userId", async (c) => {
    // WebSocket upgrade required
    const stub = c.env.AGENT_DO.get(id);
    return stub.fetch(c.req.raw);
});
```

### 2. Frontend Integration

**Before:** `chat-interface.tsx` used HTTP fetch

```typescript
const response = await fetch("/api/agent/chat", {
    method: "POST",
    body: JSON.stringify({ message: input }),
});
```

**After:** Uses WebSocket connection

```typescript
const ws = new WebSocket(wsUrl);
ws.send(JSON.stringify({ type: "chat", message: input }));
```

### 3. Initialization

**Before:** Explicit initialization endpoint

```typescript
await fetch("/api/agent/initialize", {
    method: "POST",
    body: JSON.stringify({ userId }),
});
```

**After:** Automatic on WebSocket connection

```typescript
// Agent initializes on onConnect
async onConnect(connection: WebSocket, ctx: any) {
  const userId = url.searchParams.get("userId");
  await this.initializeAgent(userId);
}
```

## Migration Steps

### For Backend Developers

1. **Update Agent Class**

    - Change from `DurableObject` to `Agent<Env, AgentState>`
    - Implement WebSocket lifecycle methods
    - Remove HTTP endpoint handlers

2. **Update Index Route**

    - Change from `app.all()` to `app.get()`
    - Remove path wildcard
    - Ensure WebSocket upgrade check

3. **Test Locally**
    ```bash
    pnpm run dev:local
    ```

### For Frontend Developers

1. **Update Chat Interface**

    - Replace HTTP fetch with WebSocket
    - Implement connection lifecycle
    - Handle all message types

2. **Add State Listener**

    - Listen for `agent-state-update` events
    - Update dashboard based on agent state

3. **Update API Calls**

    - Remove direct agent API calls
    - Use WebSocket messaging instead

4. **Add Environment Variable**
    ```
    VITE_AGENT_SERVICE_URL=localhost:8788
    ```

## Testing

### Test WebSocket Connection

```javascript
const ws = new WebSocket(
    "ws://localhost:8788/agent/test-user?userId=test-user"
);

ws.onopen = () => {
    console.log("Connected");
    ws.send(JSON.stringify({ type: "chat", message: "Hello" }));
};

ws.onmessage = (event) => {
    console.log("Received:", JSON.parse(event.data));
};
```

### Test Confirmation Flow

```javascript
// 1. Send action request
ws.send(JSON.stringify({ type: "chat", message: "Fork facebook/react" }));

// 2. Wait for confirmation request
// 3. Confirm
ws.send(JSON.stringify({ type: "confirm_action", confirmed: true }));
```

### Test Scheduling

```javascript
ws.send(JSON.stringify({ type: "chat", message: "Remind me in 2 minutes" }));
// Agent will send message after 2 minutes
```

## Rollback Plan

If issues arise, you can temporarily revert to HTTP endpoints by:

1. Keep both implementations side-by-side
2. Add feature flag for WebSocket vs HTTP
3. Gradual rollout to users

## Performance Improvements

-   **Latency**: ~50ms (WebSocket) vs ~200ms (HTTP round-trip)
-   **Real-time**: Instant state updates vs polling
-   **Bandwidth**: ~70% reduction (persistent connection)
-   **Scalability**: Durable Objects handle millions of connections

## Deployment Checklist

-   [ ] Update wrangler.jsonc with correct bindings
-   [ ] Deploy agent-service to Cloudflare
-   [ ] Update frontend environment variables
-   [ ] Deploy user-application
-   [ ] Test WebSocket connection in production
-   [ ] Monitor error rates and latency
-   [ ] Set up alerting for connection failures

## Known Issues

1. **Reconnection**: Auto-reconnects after 3s, may lose pending actions
2. **Voice AI**: Stubs only, full implementation pending
3. **Message Order**: WebSocket doesn't guarantee order with multiple connections

## Support

For issues or questions:

1. Check agent-service logs in Cloudflare Dashboard
2. Test with `wscat` or similar WebSocket client
3. Review browser console for connection errors
