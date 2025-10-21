import { betterAuth, type BetterAuthOptions } from "better-auth";

export const createBetterAuth = (config: {
	database: BetterAuthOptions["database"];
	secret?: BetterAuthOptions["secret"];
	baseURL?: BetterAuthOptions["baseURL"];
	trustedOrigins?: BetterAuthOptions["trustedOrigins"];
	socialProviders?: BetterAuthOptions["socialProviders"];
}): ReturnType<typeof betterAuth> => {
	return betterAuth({
		database: config.database,
		secret: config.secret,
		baseURL: config.baseURL,
		trustedOrigins: config.trustedOrigins,
		emailAndPassword: {
			enabled: false,
		},
		socialProviders: config.socialProviders
			? {
					...config.socialProviders,
					github: config.socialProviders.github
						? {
								...config.socialProviders.github,
							}
						: undefined,
				}
			: undefined,
		user: {
			modelName: "auth_user",
		},
		session: {
			modelName: "auth_session",
		},
		verification: {
			modelName: "auth_verification",
		},
		account: {
			modelName: "auth_account",
		},
	});
};
