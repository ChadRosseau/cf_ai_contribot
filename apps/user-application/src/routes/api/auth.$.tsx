import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@repo/data-ops/auth/server";

const authHandler = async ({ request }: { request: Request }) => {
	const auth = getAuth();
	return auth.handler(request);
};

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: authHandler,
			POST: authHandler,
		},
	},
});
