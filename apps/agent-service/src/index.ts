/**
 * Agent Service - Entry Point
 * Manages per-user AI agents via Durable Objects
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { ContribotAgent } from "./durable-objects/agent";

const app = new Hono<{ Bindings: Env }>();

app.use(
	"*",
	cors({
		origin: "*",
		credentials: true,
	}),
);

app.get("/", (c) => {
	return c.json({
		service: "contribot-agent-service",
		version: "1.0.0",
		description:
			"AI agent service for Contribot - manages per-user agents via Durable Objects",
		endpoints: {
			agent: "POST /agent/:userId/* - Agent endpoints",
			health: "GET /health - Health check",
		},
	});
});

app.get("/health", (c) => {
	return c.json({ status: "healthy", service: "agent-service" });
});

app.all("/agent/:userId/*", async (c) => {
	const userId = c.req.param("userId");

	if (!userId) {
		return c.json({ error: "User ID required" }, 400);
	}

	const id = c.env.AGENT_DO.idFromName(userId);
	const stub = c.env.AGENT_DO.get(id);

	const path = c.req.path.replace(`/agent/${userId}`, "");
	const url = new URL(c.req.url);
	url.pathname = path || "/";

	console.log("URL:", url.toString());

	return stub.fetch(url.toString(), c.req.raw);
});

export { ContribotAgent };

export default {
	fetch: app.fetch,
};
