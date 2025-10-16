declare module "cloudflare:workers" {
	interface Env {
		DB: D1Database;
		AI: Ai;
		ContribotAgent: DurableObjectNamespace;
		OPENAI_API_KEY: string;
		GITHUB_MCP_SERVER_URL: string;
		BETTER_AUTH_SECRET: string;
		GITHUB_CLIENT_ID: string;
		GITHUB_CLIENT_SECRET: string;
	}
}
