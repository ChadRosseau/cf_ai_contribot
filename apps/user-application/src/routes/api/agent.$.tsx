/**
 * Agent API Routes - Proxy to agent-service
 */

import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@repo/data-ops/auth/server";

const handler = async ({
	request,
	params,
	context,
}: {
	request: Request;
	params: { _splat?: string };
	context: any;
}) => {
	const auth = getAuth();
	const session = await auth.api.getSession({ headers: request.headers });

	console.log(`Run Id: ${crypto.randomUUID()}`);

	console.log("[Agent API] Session:", {
		hasSession: !!session,
		hasUser: !!session?.user,
		userId: session?.user?.id,
	});

	if (!session?.user?.id) {
		console.error("[Agent API] No valid session or user ID");
		return new Response(
			JSON.stringify({
				error: "Unauthorized - no valid session",
				debug: {
					hasSession: !!session,
					hasUser: !!session?.user,
					hasUserId: !!session?.user?.id,
				},
			}),
			{
				status: 401,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	const userId = session.user.id;
	console.log("UserId: ", userId);
	const path = params._splat;
	const agentService =
		(context as any)?.AGENT_SERVICE || (globalThis as any).AGENT_SERVICE;
	if (!agentService) {
		return new Response(
			JSON.stringify({ error: "Agent service not available" }),
			{
				status: 503,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	// Forward request to agent service with userId in the path
	// Agent service extracts userId from pathname, not body
	const url = new URL(request.url);
	url.pathname = `/agent/${userId}/${path}`;

	const forwardRequest = new Request(url.toString(), {
		method: request.method,
		headers: request.headers,
		body: request.body,
	});

	return agentService.fetch(forwardRequest);
};

export const Route = createFileRoute("/api/agent/$")({
	server: {
		handlers: {
			GET: handler,
			POST: handler,
		},
	},
});
