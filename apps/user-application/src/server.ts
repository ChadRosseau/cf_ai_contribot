// DO NOT DELETE THIS FILE!!!
// This file is a good smoke test to make sure the custom server entry is working
import { setAuth } from "@repo/data-ops/auth/server";
import { initDatabase } from "@repo/data-ops/database/setup";
import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";

export default {
	fetch(request: Request) {
		const url = new URL(request.url);

		// Route WebSocket connections to agent service
		// This handles /agents/:agentName/:roomId paths
		if (url.pathname.startsWith("/agents/")) {
			console.log(
				"[User App] Routing WebSocket request to agent service:",
				url.pathname,
			);
			return env.AGENT_SERVICE.fetch(request);
		}

		const db = initDatabase(env.DB); // D1 binding

		// Get the base URL from the request for proper cookie configuration
		const baseURL = `${url.protocol}//${url.host}`;

		setAuth({
			secret: env.BETTER_AUTH_SECRET,
			baseURL,
			trustedOrigins: [baseURL],
			socialProviders: {
				github: {
					clientId: env.GITHUB_CLIENT_ID,
					clientSecret: env.GITHUB_CLIENT_SECRET,
					scope: ["read:user", "user:email", "public_repo"],
				},
			},
			adapter: {
				drizzleDb: db,
				provider: "sqlite",
			},
		} as Parameters<typeof setAuth>[0]);
		(globalThis as Record<string, unknown>).AGENT_SERVICE = env.AGENT_SERVICE;
		return handler.fetch(request, {
			context: {
				fromFetch: true,
				AGENT_SERVICE: env.AGENT_SERVICE,
			} as { fromFetch: boolean; AGENT_SERVICE: typeof env.AGENT_SERVICE },
		});
	},
};
