/**
 * Recommended Issues API Route
 * Returns paginated issues matching user preferences (languages and difficulty)
 * Supports optional repo filtering
 */

import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@repo/data-ops/auth/server";
import { getDb } from "@repo/data-ops/database/setup";
import { getUserPreferences } from "@repo/data-ops/queries/users";
import {
	getPaginatedRecommendedIssues,
	getRecommendedIssuesCount,
} from "@repo/data-ops/queries/issues";

export const Route = createFileRoute("/api/issues/recommended")({
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
				const userId = session.user.id;

				try {
					const url = new URL(request.url);
					const page = parseInt(url.searchParams.get("page") || "1");
					const limit = parseInt(url.searchParams.get("limit") || "10");
					const repoFilter = url.searchParams.get("repo") || undefined;

					// Get filter overrides from query params
					const languagesParam = url.searchParams.get("languages");
					const difficultyParam = url.searchParams.get("difficulty");

					const preferences = await getUserPreferences(db as any, userId);

					if (!preferences) {
						return new Response(
							JSON.stringify({
								error: "User preferences not found",
							}),
							{
								status: 404,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					// Use query params if provided, otherwise fall back to user preferences
					const languages = languagesParam
						? languagesParam.split(",")
						: preferences.preferredLanguages;
					const difficulty = difficultyParam
						? parseInt(difficultyParam)
						: preferences.difficultyPreference;

					// Use exact difficulty matching when explicitly filtered, range when using preferences
					const exactDifficulty = !!difficultyParam;

					const [issues, total] = await Promise.all([
						getPaginatedRecommendedIssues(
							db as any,
							languages,
							difficulty,
							page,
							limit,
							repoFilter,
							exactDifficulty,
						),
						getRecommendedIssuesCount(
							db as any,
							languages,
							difficulty,
							repoFilter,
							exactDifficulty,
						),
					]);

					return new Response(JSON.stringify({ issues, total }), {
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
