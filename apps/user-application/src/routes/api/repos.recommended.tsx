/**
 * Recommended Repos API Route
 * Returns paginated repositories with open issues
 */

import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@repo/data-ops/auth/server";
import { getDb } from "@repo/data-ops/database/setup";
import { getPaginatedRepos, getReposCount } from "@repo/data-ops/queries/repos";

export const Route = createFileRoute("/api/repos/recommended")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const auth = getAuth();
				const session = await auth.api.getSession({
					headers: request.headers,
				});

				if (!session?.user) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				const db = getDb();

				try {
					const url = new URL(request.url);
					const page = parseInt(url.searchParams.get("page") || "1");
					const limit = parseInt(url.searchParams.get("limit") || "10");

					const [repos, total] = await Promise.all([
						getPaginatedRepos(db as any, page, limit),
						getReposCount(db as any),
					]);

					return new Response(JSON.stringify({ repos, total }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch (error) {
					console.error("Failed to fetch recommended repos:", error);
					return new Response(
						JSON.stringify({ error: "Internal server error" }),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			},
		},
	},
});
