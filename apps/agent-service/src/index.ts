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
						agent: "WebSocket /agents/:agentName/:roomId - Connect to agent",
						health: "GET /health - Health check",
						commands:
							"GET|POST /agent/:userId/:command - Execute agent commands (e.g., /agent/:userId/languages)",
					},
				}),
				origin,
			);
		}

		// Direct agent commands - /agent/:userId/:command
		// This handles direct HTTP requests to the agent (not WebSocket)
		const agentCommandMatch = url.pathname.match(/^\/agent\/([^\/]+)\/(.+)$/);
		if (agentCommandMatch) {
			const userId = agentCommandMatch[1];
			const command = agentCommandMatch[2];
			console.log(
				`[Agent Service] Agent command: ${command} for user: ${userId}`,
			);

			try {
				// Get the agent Durable Object stub
				const agentId = env.ContribotAgent.idFromName(userId);
				const agentStub = env.ContribotAgent.get(agentId);

				// Initialize the agent with the user ID
				await agentStub.fetch("https://agent/initialize", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userId }),
				});

				// Forward the command to the agent
				const commandResponse = await agentStub.fetch(
					`https://agent/${command}`,
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

		// Use the Agents SDK router which handles WebSocket upgrades and routing
		// This handles all /agents/:agentName/:roomId paths
		const response = await routeAgentRequest(request, env);

		if (response) {
			// Don't wrap WebSocket upgrades (status 101) - they need special handling
			return corsHeaders(response, origin);
		}

		return corsHeaders(new Response("Not found", { status: 404 }), origin);
	},
} satisfies ExportedHandler<Env>;
