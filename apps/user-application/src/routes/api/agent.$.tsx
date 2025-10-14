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
	if (!session?.user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const userId = session.user.id;
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

	const url = new URL(request.url);
	url.pathname = `/agent/${userId}/${path}`;

	let body = {} as any;
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	body.userId = userId;

	const forwardRequest = new Request(url.toString(), {
		method: request.method,
		headers: request.headers,
		body:
			request.method !== "GET" && request.method !== "HEAD"
				? JSON.stringify(body)
				: undefined,
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
