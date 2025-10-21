/**
 * Agent Service - Entry Point
 * Routes requests to Cloudflare Agents SDK with CORS support
 */

import { routeAgentRequest } from "agents";
import type { Env } from "cloudflare:workers";
import { ContribotAgent } from "./durable-objects/agent";

export { ContribotAgent };

/**
 * Add CORS headers to a response
 * For production, restrict origins to your actual domains
 */
function corsHeaders(response: Response, origin?: string): Response {
	// WebSocket upgrades (status 101) should not be wrapped - return as-is
	if (response.status === 101) {
		return response;
	}

	const headers = new Headers(response.headers);

	// In development, allow localhost. In production, restrict to your domains.
	const allowedOrigins = [
		"http://localhost:3000",
		"http://localhost:3001",
		"https://contribot.net", // TODO: Update with your actual domain
	];

	const requestOrigin = origin || "*";
	if (allowedOrigins.includes(requestOrigin) || requestOrigin === "*") {
		headers.set("Access-Control-Allow-Origin", requestOrigin);
	}

	headers.set(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, DELETE, OPTIONS",
	);
	headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
	headers.set("Access-Control-Allow-Credentials", "true");

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

/**
 * Worker entry point that routes incoming requests to the appropriate agent handler
 * The Agents SDK handles WebSocket upgrades, routing, and Durable Object instantiation
 */
export default {
	async fetch(
		request: Request,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<Response> {
		// Check for OpenAI API key
		if (!env.OPENAI_API_KEY) {
			console.warn(
				"[Agent Service] OPENAI_API_KEY is not set. Add it to .dev.vars for local dev, or use `wrangler secret put OPENAI_API_KEY` for production.",
			);
		}

		const url = new URL(request.url);
		const origin = request.headers.get("Origin") || "*";

		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			const allowedOrigins = [
				"http://localhost:3000",
				"http://localhost:3001",
				"https://your-production-domain.com",
			];

			const responseOrigin = allowedOrigins.includes(origin) ? origin : "*";

			return new Response(null, {
				headers: {
					"Access-Control-Allow-Origin": responseOrigin,
					"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization",
					"Access-Control-Allow-Credentials": "true",
					"Access-Control-Max-Age": "86400",
				},
			});
		}

		// Health check endpoint
		if (url.pathname === "/health") {
			return corsHeaders(
				Response.json({
					status: "healthy",
					service: "agent-service",
					version: "2.0.0",
				}),
				origin,
			);
		}

		// Home endpoint
		if (url.pathname === "/") {
			return corsHeaders(
				Response.json({
					service: "contribot-agent-service",
					version: "2.0.0",
					description:
						"AI agent service for Contribot - powered by Cloudflare Agents SDK with WebSocket support",
					endpoints: {
						agent:
							"WebSocket /agents/contribot-agent/:userId - Connect to agent",
						health: "GET /health - Health check",
						commands:
							"GET|POST /agent/:userId/:command - Execute agent commands (e.g., /agent/:userId/languages)",
					},
				}),
				origin,
			);
		}

		// WebSocket connections - /agents/:agentName/:roomId (plural "agents")
		// Handle these FIRST before custom HTTP routes to avoid conflicts
		// The Agents SDK's routeAgentRequest() expects agent name to match the DO binding name
		if (url.pathname.startsWith("/agents/")) {
			console.log(`[Agent Service] WebSocket request: ${url.pathname}`);
			const response = await routeAgentRequest(request, env);

			if (response) {
				console.log(
					`[Agent Service] Agents SDK response status: ${response.status}`,
				);
				// Return WebSocket upgrade without CORS wrapping (status 101)
				if (response.status === 101) {
					return response;
				}
				return corsHeaders(response, origin);
			}

			console.log(`[Agent Service] No response from Agents SDK`);
			return corsHeaders(
				new Response("WebSocket connection failed", { status: 404 }),
				origin,
			);
		}

		// Direct agent commands - /agent/:userId/:command (singular "agent")
		// This handles direct HTTP requests to the agent (not WebSocket)
		const agentCommandMatch = url.pathname.match(/^\/agent\/([^\/]+)\/(.+)$/);
		if (agentCommandMatch) {
			const userId = agentCommandMatch[1];
			const command = agentCommandMatch[2];
			console.log(
				`[Agent Service] HTTP agent command: ${command} for user: ${userId}`,
			);

			try {
				// Get the agent Durable Object stub
				const agentId = env.ContribotAgent.idFromName(userId);
				const agentStub = env.ContribotAgent.get(agentId);

				// Forward the command to the agent with userId in the URL path
				// The agent will extract userId from the path and initialize itself if needed
				const commandResponse = await agentStub.fetch(
					`https://agent/${command}?userId=${userId}`,
					{
						method: request.method,
						headers: request.headers,
						body: request.body,
					},
				);

				return corsHeaders(commandResponse, origin);
			} catch (error) {
				console.error(
					`[Agent Service] Error executing command ${command}:`,
					error,
				);
				return corsHeaders(
					Response.json(
						{
							error: `Failed to execute command: ${command}`,
							details: error instanceof Error ? error.message : String(error),
						},
						{ status: 500 },
					),
					origin,
				);
			}
		}

		// No route matched
		console.log(`[Agent Service] No route matched for: ${url.pathname}`);
		return corsHeaders(new Response("Not found", { status: 404 }), origin);
	},
} satisfies ExportedHandler<Env>;
