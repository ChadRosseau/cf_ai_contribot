# Cloudflare Agents — Implementation Guide for an AI Coding Tool

*Target audience: an AI agent that will implement a Cloudflare Agent itself.*
Format: **Markdown**. Length/Depth: ~12–16 pages (concise code examples, production deployment details, security, cost/rate-limit guidance). Includes sparse backlinks to the official Cloudflare Agents pages and starter repo.

---

## Quick orientation (TL;DR)

* **What an Agent is (high level):** an autonomous, stateful program running on Cloudflare that can plan, call LLMs, use tools, maintain state, schedule work, and take actions. It’s built from the `agents` SDK and integrates with Cloudflare Workers, Durable Objects, Workflows, Workers AI (or AI Gateway), and supporting services (D1, R2, Vectorize, etc.). ([agents.cloudflare.com][1])
* **Primary runtime pieces you will implement:** the Agent class (SDK), Tool adapters, MCP server or direct LLM calls via Workers AI/AI Gateway, durable state backing (Durable Objects / D1 / KV), and workflow/scheduler integration. ([Cloudflare Docs][2])
* **Production essentials covered below:** authorization & secrets, deployment with `wrangler` and Cloudflare account bindings, observability, cost/rate-limit strategies, and a readiness checklist with examples (concise).

---

# Table of contents

1. Concepts & components
2. Core API patterns (class + callables + scheduling)
3. Interacting with LLMs: Workers AI vs AI Gateway (patterns)
4. State & durable storage (Durable Objects, KV, D1, Vectorize)
5. Tools, MCP, and transports (MCP servers & clients)
6. Scheduling & Workflows integration
7. Production deployment (wrangler, account, bindings, routes)
8. Security & secrets management
9. Cost, scaling & rate-limit mitigation
10. Monitoring, logging & debugging checklist
11. Example: Minimal Agent implementation (concise)
12. Troubleshooting & gotchas
13. References & links

---

# 1. Concepts & components (what your agent must know)

* **Agent (SDK):** a class you extend that encapsulates state, handlers, scheduled jobs, and callable methods. Agents are the programming model for agentic behavior. (See examples on Cloudflare product pages and docs.) ([agents.cloudflare.com][1])
* **Tools:** small adapters that let agents perform actions (HTTP APIs, browser rendering, vector searches, D1 queries, R2 operations). Tools are invoked synchronously or asynchronously by the agent when executing a plan. ([Cloudflare Docs][2])
* **Durable State & Execution Engine:** Cloudflare Durable Objects provide stateful edge execution; Workflows provide long-running orchestrations and scheduled operations. Combine these for guaranteed execution. ([agents.cloudflare.com][1])
* **LLM access:** Workers AI hosts LLMs on Cloudflare; AI Gateway bridges to third-party providers. Your agent must decide where to run model inference depending on latency, cost, and model availability. ([agents.cloudflare.com][1])
* **MCP (Model Context Protocol):** protocol for tool/agent/mcp-server communication; remote MCP servers let you host tool logic off-edge and register it with Cloudflare. (Docs reference in Agents docs.) ([Cloudflare Docs][2])

---

# 2. Core API patterns

## Agent class shape (pseudo/concise)

```ts
import { Agent, unstable_callable as callable } from "agents";

type MyState = { tasks: string[]; lastResult?: string };

export class MyAgent extends Agent<Env, MyState> {
  onStart() {
    // Called when agent bootstraps; schedule recurring jobs here
    this.schedule("daily at 02:00", "dailyCleanup");
  }

  @callable()
  async addTask(task: string) {
    const s = this.state;
    s.tasks.push(task);
    this.setState(s);
  }

  async dailyCleanup() {
    // use LLM via this.env.AI.run(...) or call tools
  }
}
```

* `@callable()` marks functions that can be invoked by external clients.
* `this.state` is the per-agent state object, persisted via Durable Objects (or the agent runtime).
* `this.env` gives access to environment bindings (AI client, workflows, MCP clients, R2, D1, etc.). ([agents.cloudflare.com][1])

## Callable vs internal methods

* **Callable:** externally triggered (API, MCP calls, user actions).
* **Internal (private):** scheduled, invoked by workflows, or called by callables as helper logic.

## Tool invocation example (concise)

```ts
// Example: call Workers AI (high-level)
const { response } = await this.env.AI.run("llama-3.3-70b-instruct", {
  messages: [{ role: "system", content: "You are an assistant." }, { role: "user", content: prompt }]
});
```

*(Use the Cloudflare-provided AI client or AI Gateway adapter as a tool — see section on LLMs.)* ([agents.cloudflare.com][1])

---

# 3. Interacting with LLMs: Workers AI vs AI Gateway

**Workers AI (hosted by Cloudflare)**

* Pros: low-latency, billing based on CPU time rather than wall-time, tighter platform integration.
* Use-case: when you can run the model on Cloudflare or when you want minimal outbound external calls. ([agents.cloudflare.com][1])

**AI Gateway (third-party providers)**

* Pros: access to models not hosted on Cloudflare; flexible provider choices.
* Use-case: when you need a specific model or provider feature.

**Pattern recommendations**

* Abstract LLM access behind a small `LLMClient` interface that supports `run()` and `stream()` so agents can switch between Workers AI and AI Gateway without changing core agent logic.
* Keep prompts modular: system + tool instructions + user content. Always include a short system instruction describing agent role.

---

# 4. State & durable storage

Cloudflare provides multiple persistence mechanisms. Choose based on access patterns.

* **Durable Objects** — ideal for per-agent state, fast read/write, strong consistency for single-agent shards. Use for agent state (in-memory model + persistence) and for WebSocket connection hibernation. ([agents.cloudflare.com][1])
* **KV (Workers KV)** — eventually consistent, cheap, global; good for large read-heavy datasets or caches.
* **D1 (SQLite)** — relational data, good for complex queries and transactional needs.
* **R2** — object storage for large artifacts (files, images).
* **Vectorize (Cloudflare Vector store)** — for retrieval/semantic search. Use for RAG and context retrieval. ([agents.cloudflare.com][1])

**Design pattern:** keep frequently-updated/consistently-used per-agent state in Durable Objects, use Vectorize for embeddings & RAG, D1 for structured records, R2 for archives.

---

# 5. Tools, MCP, and transports

* **Tools**: provide structured actions to the agent (e.g., HTTP tool to call external APIs, Browser Rendering tool to scrape pages, Vectorize to store/retrieve embeddings). Tools should be deterministic and have clear input/output schemas. ([Cloudflare Docs][2])
* **MCP (Model Context Protocol):** if your agent or toolchain uses remote MCP servers, implement the MCP server to expose tools in a format Cloudflare recognizes. The Agents docs include MCP references and API endpoints. ([Cloudflare Docs][2])

**Tool adapter pattern**

```ts
class HttpTool {
  constructor(private baseUrl: string, private secret: string) {}
  async run({ method, path, body }: {method: string; path: string; body?: any}) {
    // implement fetch with retries, backoff, timeouts
  }
}
```

* Always wrap external calls with timeout, retry-with-backoff, circuit-breaker, and rate-limit awareness.

---

# 6. Scheduling & Workflows

* **Workflows** are Cloudflare's orchestration primitives for guaranteed, scheduled, or long-running execution. Use them to schedule agent tasks, coordinate retries, or handle complex multi-step flows. Combine Workflows with Durable Objects for stateful transitions. ([agents.cloudflare.com][1])
* Agents can call `this.schedule()` for internal scheduling patterns and can create workflow instances via `this.env.WORKFLOW.create({...})` (a conceptual example — check your env bindings).

**Scheduling pattern**

* Short-lived per-agent periodic tasks → `this.schedule("cron", "taskName")`.
* Multi-step guaranteed execution → Workflows, with Durable Objects for lock/state.

---

# 7. Production deployment (required detail)

This section is intentionally thorough and prescriptive — everything the AI agent will need to perform deployment.

## Account & preliminaries

1. **Cloudflare account & Workers enabled** for the target account.
2. **Obtain API token** with the minimum required permissions (Workers, Durable Objects, KV, R2, D1, AI/AI Gateway) for CI usage.

## Local/CI tool: `wrangler`

* Use `wrangler` (Cloudflare CLI) for builds, publishing, and environment variable management.
* Project `wrangler.toml` must contain your account id, `name`, `compatibility_date`, and bindings (Durable Objects, KV namespaces, D1, R2, environment secrets). Example:

```toml
name = "my-agent-worker"
main = "src/index.ts"
compatibility_date = "2025-10-01"
account_id = "your-account-id"

[env.production]
# route or zone config (if using routes)
route = "https://api.example.com/*"

[[bindings]]
type = "durable_object_namespace"
name = "AGENTS_DO"
class_name = "AgentsDurable"
# other bindings: kv_namespaces, d1_databases, r2_buckets, services
```

## Build & package

* Keep dependencies lean. The `agents` SDK is normally an npm package (`npm i agents`). Bundle with esbuild/webpack targeting Cloudflare Workers. Use tree-shaking to keep worker size small.
* Use `NODE_ENV=production` and strip dev-only modules.

## Secrets & Environment Bindings

* In `wrangler`, set secrets with `wrangler secret put <NAME>` or via the Cloudflare dashboard for production. Avoid embedding secrets in code or checked-in files.
* Example bindings: `AI_KEY`, `MCP_SECRET`, provider API keys, DB credentials.

## Durable Object & Bindings

* Register Durable Object classes in `wrangler.toml`. Ensure the code exports the DO binding class name. Example:

```ts
export class AgentsDurable {
  // implementation of agent state and handlers
}
```

## Publish flow (CI steps)

1. Lint & type-check.
2. Run tests (unit & integration).
3. Build bundle.
4. `wrangler publish --env production` (or `wrangler deploy` depending on setup).
5. Post-deploy smoke tests: call health endpoint, ensure DO instantiation works, verify AI run connectivity.

## Canary/blue-green

* Use Cloudflare Workers environments (“staging” envs) or release routing to test before production. Keep traffic split or test via `route` targeting a staging subdomain.

## Post-deploy jobs

* Register schedules (if not set by startup), warm caches (optional), and ensure workflow triggers are active.

**Repo starter:** the `agents-starter` GitHub shows a canonical layout and examples which you should mirror for structure and bundling. ([GitHub][3])

---

# 8. Security & secrets management

**Principles**

* Least-privilege for API tokens and service accounts.
* Rotate keys automatically (schedule rotation with a secure vault or API).
* Avoid storing long-lived secrets in code or committed files.

**Implementation**

* Use `wrangler secret put` (or dashboard) for secrets accessible to Workers. These are encrypted and available as runtime env variables (not accessible client-side).
* For per-agent delegated credentials (e.g., user-specific external API tokens), store encrypted tokens in D1/R2 and only decrypt in the agent environment with limited scope. Consider using short-lived tokens / OAuth flows where possible.

**Authentication patterns**

* **Incoming requests:** verify JWTs or signed requests before mapping to callables.
* **Inter-service auth:** use mTLS or signed tokens for MCP servers and remote MCP clients. The Agents docs include Authorization/MCP notes — ensure your MCP services authenticate and authorize by agent id, tool id, and scope. ([Cloudflare Docs][2])

**Network & data protection**

* Enforce HTTPS.
* Minimize PII in logs (mask or redact).
* Use encryption for sensitive long-term data stored in R2/D1.

---

# 9. Cost, scaling & rate-limit mitigation

**Understand the billing model**

* Cloudflare emphasizes paying for CPU time (not wall time), so blocking on I/O (slow external APIs or long LLM waits) still charges CPU only while code runs. However, repeated bursts and model inference costs matter — structure calls accordingly. ([agents.cloudflare.com][1])

**Mitigation techniques**

* **Batching:** group multiple user tasks/queries into one LLM call when possible.
* **Caching:** cache LLM responses for identical prompts for short TTLs. Use KV or Durable Object cache.
* **Rate-limiting & backoff:** implement retry policies with exponential backoff and circuit breakers around external providers.
* **Hibernation / WebSocket hibernation:** rely on Durable Objects’ hibernation to reduce cost for idle connections. ([agents.cloudflare.com][1])
* **Model selection:** use smaller models for less-critical reasoning, larger models for final responses. Abstract model selection in your `LLMClient`.

**Autoscaling & concurrency**

* Cloudflare Workers auto-scale; however, Durable Objects have concurrency semantics (one instance per object). Design to shard agent IDs and partition load to parallelize across multiple DO instances if needed.

---

# 10. Monitoring, logging & debugging

**What to capture**

* Errors & stack traces (with correlation IDs).
* Key lifecycle events (agent creation, schedule execution, tool invocation, LLM calls).
* Latency metrics (LLM call duration, tool call duration, scheduling durations).
* Cost/usage metrics (LLM usage, CPU time, external calls).

**Tools**

* Cloudflare Workers logs (via dashboard), structured logging to an external sink (if needed).
* Expose a `/health` endpoint for smoke checks.
* Include metrics instrumentation hooks (prometheus-style via a metrics collector) if you push metrics externally.

**Local debugging**

* Unit-test agent logic with mocked tools/LLM clients. The `agents-starter` repo shows test patterns for mocking remote MCP servers and LLM responses. ([GitHub][3])

---

# 11. Example: Minimal concise Agent (end-to-end sketch)

```ts
// src/agents/lunch-agent.ts
import { Agent, unstable_callable as callable } from "agents";

type State = { votes: Record<string,string>[]; ruling?: string }

export class LunchAgent extends Agent<Env, State> {
  onStart() { this.schedule("daily at 17:00", "chooseLunch"); }

  @callable()
  async vote(username: string, restaurant: string) {
    const s = this.state;
    s.votes.push({ username, restaurant });
    this.setState(s);
  }

  async chooseLunch() {
    const winners = pickWinners(this.state.votes);
    const { response } = await this.env.AI.run("llama-3.3-70b-instruct", {
      messages: [
        { role: "system", content: "Write an enthusiastic announcement." },
        { role: "user", content: winners.join(", ") }
      ]
    });
    this.setState({ ...this.state, ruling: response });
    // push notification via tool
    await this.env.NOTIFY_TOOL.run({ message: response });
  }
}
```

* Bindings: Durable Object for per-agent state, AI client binding as `AI`, notify tool injected. See `agents-starter` for structure. ([GitHub][3])

---

# 12. Troubleshooting & common gotchas

* **State inconsistencies:** make sure to serialize/deserialize state consistently; Durable Objects are single-threaded per object — race conditions occur only via multiple object IDs.
* **Large binaries or node modules:** workers have bundle size limits. Keep dependencies minimal and prefer web-compatible libs.
* **LLM timeouts:** guard long LLM responses with streaming or token-limited requests; implement a fallback if model stalls.
* **Authentication mismatch:** verify MCP server tokens & scope; mismatched scopes often cause "tool not found" issues.

---

# 13. Readiness checklist before production

* [ ] Secrets stored via `wrangler` / dashboard, no secrets in repo.
* [ ] Minimal permissions for CI tokens.
* [ ] Missing external endpoints are mocked in tests.
* [ ] Per-agent storage design chosen (Durable Objects/D1/Vectorize).
* [ ] Observability endpoints (health, metrics) present.
* [ ] Error handling, retries, and circuit breakers implemented for all external calls.
* [ ] Cost mitigations: caching, batching, model selection done.
* [ ] Post-deploy smoke tests scripted in CI.

---

# 14. Key references (sparse backlinks)

* Cloudflare Agents product overview & quick examples. ([agents.cloudflare.com][1])
* Cloudflare Agents docs (concepts, MCP, Tools, Workflows). ([Cloudflare Docs][2])
* `agents-starter` GitHub repository (project layout and starter code). ([GitHub][3])

---

# Appendix A — Short patterns / snippets

**LLMClient abstraction**

```ts
interface LLMClient {
  run(model: string, payload: any): Promise<{response: string}>;
}
class WorkersAIClient implements LLMClient { /* uses this.env.AI.run */ }
class AIGatewayClient implements LLMClient { /* proxy to third-party */ }
```

**Safe fetch wrapper (tool)**

```ts
async function safeFetch(url:string, opts:any) {
  const res = await fetch(url, { ...opts, timeout: 5000 }); // conceptual
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

**Circuit-breaker sketch**

* Track consecutive failures per tool, open circuit after threshold, retry after backoff window.

---

# Final notes for the implementing agent

1. **Start small:** implement an agent focused on a single tool and a single short workflow (e.g., collect input, call LLM, write to Vectorize).
2. **Mock aggressively:** most bugs are integration issues (auth, bindings, serialization). Use the `agents-starter` repo tests as a model. ([GitHub][3])
3. **Abstract platform pieces:** keep LLM access, tools, and storage behind small interfaces so switching providers or moving logic off-edge is easy.
4. **Safety:** include prompt-safety guards (sanitize inputs, verify tool outputs before acting, rate-limit user-triggered workflows).

---
