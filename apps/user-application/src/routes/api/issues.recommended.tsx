/**
 * Recommended Issues API Route
 * Returns issues matching user preferences (languages and difficulty)
 */

import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@repo/data-ops/auth/server";
import { getDb } from "@repo/data-ops/database/setup";
import { getUserPreferences } from "@repo/data-ops/queries/users";
import { getRecommendedIssues } from "@repo/data-ops/queries/issues";

export const Route = createFileRoute("/api/issues/recommended")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const auth = getAuth();
				const session = await auth.api.getSession({ headers: request.headers });

				if (!session?.user) {
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: { "Content-Type": "application/json" },
					});
				}

				const db = getDb();
				const userId = session.user.id;

				try {
					const preferences = await getUserPreferences(db as any, userId);

					if (!preferences) {
						return new Response(
							JSON.stringify({ error: "User preferences not found" }),
							{
								status: 404,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					const issues = await getRecommendedIssues(
						db as any,
						preferences.preferredLanguages,
						preferences.difficultyPreference,
						20,
					);

					return new Response(JSON.stringify({ issues }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch (error) {
					console.error("Failed to fetch recommended issues:", error);
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
