import { createBetterAuth } from "@/auth/setup";
import { getDb } from "@/database/setup";
import {
	auth_account,
	auth_session,
	auth_verification,
	auth_user,
} from "@/drizzle/auth-schema";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { BetterAuthOptions } from "better-auth";

let betterAuth: ReturnType<typeof createBetterAuth>;

export function setAuth(config: {
	secret?: string;
	baseURL?: string;
	trustedOrigins?: string[];
	socialProviders?: BetterAuthOptions["socialProviders"];
	adapter: {
		drizzleDb: ReturnType<typeof getDb>;
		provider: Parameters<typeof drizzleAdapter>[1]["provider"];
	};
}) {
	const { adapter, ...authConfig } = config;
	betterAuth = createBetterAuth({
		database: drizzleAdapter(adapter.drizzleDb, {
			provider: adapter.provider,
			schema: {
				auth_user,
				auth_account,
				auth_session,
				auth_verification,
			},
		}),
		...authConfig,
	});
	return betterAuth;
}

export function getAuth() {
	if (!betterAuth) {
		throw new Error("Auth not initialized");
	}
	return betterAuth;
}
