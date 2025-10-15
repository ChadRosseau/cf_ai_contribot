/**
 * User Favourites Issues API Route
 * POST: Toggle favourite status for an issue
 */

import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@repo/data-ops/auth/server";
import { getDb } from "@repo/data-ops/database/setup";
import { toggleFavourite } from "@repo/data-ops/queries/favourites";

export const Route = createFileRoute("/api/user/favourites/issues")({
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
                    const { issueId, favourite } = body;

                    if (
                        typeof issueId !== "number" ||
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
                        "issue",
                        issueId,
                        favourite
                    );

                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    });
                } catch (error) {
                    console.error("Failed to toggle issue favourite:", error);
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
