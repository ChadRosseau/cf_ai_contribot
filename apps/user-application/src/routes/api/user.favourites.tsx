/**
 * User Favourites API Route
 * GET: Returns user's favourited repos and issues
 */

import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@repo/data-ops/auth/server";
import { getDb } from "@repo/data-ops/database/setup";
import { getUserFavourites } from "@repo/data-ops/queries/favourites";

export const Route = createFileRoute("/api/user/favourites")({
    server: {
        handlers: {
            GET: async ({ request }) => {
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
                    const favourites = await getUserFavourites(
                        db as any,
                        userId
                    );

                    return new Response(JSON.stringify(favourites), {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    });
                } catch (error) {
                    console.error("Failed to fetch favourites:", error);
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
