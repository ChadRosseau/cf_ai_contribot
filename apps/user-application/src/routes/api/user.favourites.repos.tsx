/**
 * User Favourites Repos API Route
 * POST: Toggle favourite status for a repo
 */

import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@repo/data-ops/auth/server";
import { getDb } from "@repo/data-ops/database/setup";
import { toggleFavourite } from "@repo/data-ops/queries/favourites";

export const Route = createFileRoute("/api/user/favourites/repos")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                const auth = getAuth();
                const session = await auth.api.getSession({
                    headers: request.headers,
                });

                if (!session?.user) {
                    return new Response(
                        JSON.stringify({ error: "Unauthorized" }),
                        {
                            status: 401,
                            headers: { "Content-Type": "application/json" },
                        }
                    );
                }

                const db = getDb();
                const userId = session.user.id;

                try {
                    const body = await request.json();
                    const { repoId, favourite } = body;

                    if (
                        typeof repoId !== "number" ||
                        typeof favourite !== "boolean"
                    ) {
                        return new Response(
                            JSON.stringify({ error: "Invalid request body" }),
                            {
                                status: 400,
                                headers: { "Content-Type": "application/json" },
                            }
                        );
                    }

                    await toggleFavourite(
                        db as any,
                        userId,
                        "repo",
                        repoId,
                        favourite
                    );

                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    });
                } catch (error) {
                    console.error("Failed to toggle repo favourite:", error);
                    return new Response(
                        JSON.stringify({ error: "Internal server error" }),
                        {
                            status: 500,
                            headers: { "Content-Type": "application/json" },
                        }
                    );
                }
            },
        },
    },
});
