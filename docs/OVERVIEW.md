# Contribot

An AI-first open-source onboarding platform where the user interacts mainly through a persistent chat on the left and a dynamic dashboard on the right. 

A scheduled background scraper (no login required) finds public repos and open beginner issues (label variants like good first issue) and writes compact records + AI-generated one-paragraph repo summaries and 2–3 sentence issue introductions to D1 — only when key metadata changes. 

User-specific interactions (fork, branch, PR, comment) are executed via a single server-side MCP wrapper (preferred) with a REST fallback, and are available both as chat-driven AI plans and as explicit UI buttons. 

Conversation memory and short-term assistant state live in Durable Objects; longer-lived/retrievable data is in D1. 

Workers AI (Llama 3.3) is used for all prompt tasks (summaries, difficulty scoring 1–5, drafting), with batching and cost controls.

### Principles & constraints

- **Scraper-only public reads**: background scraper uses GitHub API (scoped token) and runs scheduled 3×/day. No user auth needed for scraping.

- **Save AI outputs to D1**: repo summaries, issue intros, and computed difficulty scores (1–5) are stored in D1 and updated only on change.

- **Hash-based change detection**: only update rows when a deterministic metadata hash changes to limit AI calls and writes.

- **Prefer MCP for actions**: use a single MCP wrapper module invoked by server-side code for AI and UI actions; fallback to REST API where MCP lacks functionality.

- **User confirmation required**: any publishable action (PR submit, comment post) requires explicit user approval; the assistant may draft and request approval.

- **Chat-first UX but full UI parity**: same flows available via chat or buttons in the right-hand dashboard. Chat can plan/execute; UI buttons open confirmable plan flows.