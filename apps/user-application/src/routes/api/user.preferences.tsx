/**
 * User Preferences API Routes
 */

import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@repo/data-ops/auth/server";
import { getDb } from "@repo/data-ops/database/setup";
import {
	getUserPreferences,
	updateUserPreferences,
} from "@repo/data-ops/queries/users";

export const Route = createFileRoute("/api/user/preferences")({
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
						return new Response(JSON.stringify({ error: "User not found" }), {
							status: 404,
							headers: { "Content-Type": "application/json" },
						});
					}

					return new Response(
						JSON.stringify({
							preferredLanguages: preferences.preferredLanguages,
							difficultyPreference: preferences.difficultyPreference,
							onboardingCompleted: preferences.onboardingCompleted,
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				} catch (error) {
					console.error("Failed to get user preferences:", error);
					return new Response(
						JSON.stringify({ error: "Internal server error" }),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			},

			POST: async ({ request }) => {
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
					const body = await request.json();
					const { preferredLanguages, difficultyPreference } = body as {
						preferredLanguages?: string[];
						difficultyPreference?: number;
					};

					await updateUserPreferences(db as any, userId, {
						preferredLanguages,
						difficultyPreference,
						onboardingCompleted: true,
					});

					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch (error) {
					console.error("Failed to update user preferences:", error);
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
