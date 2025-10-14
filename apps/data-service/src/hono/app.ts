import { Hono } from "hono";

export const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
	return c.text("Contribot Data Service - Running");
});

// Test endpoint to manually trigger the scraper workflow
app.get("/test-scraper", async (c) => {
	try {
		// Check if workflow binding is available
		if (!c.env.SCRAPER_WORKFLOW) {
			return c.json(
				{
					success: false,
					error:
						"Workflow binding not available. Make sure you're running with 'wrangler dev' and workflows are configured in wrangler.jsonc",
					hint: "Try: wrangler dev --remote or deploy to Cloudflare to test workflows",
				},
				503,
			);
		}

		const instance = await c.env.SCRAPER_WORKFLOW.create({
			params: {
				triggeredAt: new Date().toISOString(),
			},
		});

		return c.json({
			success: true,
			message: "Scraper workflow started",
			workflowInstanceId: instance.id,
			triggeredAt: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Failed to start workflow:", error);
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

// Get workflow status by instance ID
app.get("/workflow/:instanceId/status", async (c) => {
	try {
		if (!c.env.SCRAPER_WORKFLOW) {
			return c.json(
				{
					success: false,
					error: "Workflow binding not available",
					hint: "Try: wrangler dev --remote or deploy to Cloudflare",
				},
				503,
			);
		}

		const instanceId = c.req.param("instanceId");

		if (!instanceId) {
			return c.json(
				{
					success: false,
					error: "Instance ID is required",
				},
				400,
			);
		}

		const instance = await c.env.SCRAPER_WORKFLOW.get(instanceId);
		const status = await instance.status();

		return c.json({
			success: true,
			instanceId,
			status,
		});
	} catch (error) {
		console.error("Failed to get workflow status:", error);
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

// Stop/terminate a workflow by instance ID
app.post("/workflow/:instanceId/stop", async (c) => {
	try {
		if (!c.env.SCRAPER_WORKFLOW) {
			return c.json(
				{
					success: false,
					error: "Workflow binding not available",
					hint: "Try: wrangler dev --remote or deploy to Cloudflare",
				},
				503,
			);
		}

		const instanceId = c.req.param("instanceId");

		if (!instanceId) {
			return c.json(
				{
					success: false,
					error: "Instance ID is required",
				},
				400,
			);
		}

		const instance = await c.env.SCRAPER_WORKFLOW.get(instanceId);
		await instance.terminate();

		return c.json({
			success: true,
			message: "Workflow terminated successfully",
			instanceId,
		});
	} catch (error) {
		console.error("Failed to terminate workflow:", error);
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

// Run scraper directly without workflows (for local testing)
app.get("/test-scraper-direct", async (c) => {
	try {
		console.log("Starting direct scraper run (no workflow)...");

		// Get optional limits from query params
		const maxRepos = c.req.query("maxRepos")
			? parseInt(c.req.query("maxRepos")!)
			: 6;
		const maxReposForIssues = c.req.query("maxReposForIssues")
			? parseInt(c.req.query("maxReposForIssues")!)
			: 3;
		const maxIssuesPerRepo = c.req.query("maxIssuesPerRepo")
			? parseInt(c.req.query("maxIssuesPerRepo")!)
			: 10;

		// Import the direct runner
		const { runScraperDirect } = await import("@/scrapers/run-direct");

		// Run in background so we can return immediately
		c.executionCtx.waitUntil(
			(async () => {
				try {
					const stats = await runScraperDirect(c.env, {
						maxRepos,
						maxReposForIssues,
						maxIssuesPerRepo,
					});
					console.log("\n=== Final Stats ===");
					console.log(JSON.stringify(stats, null, 2));
				} catch (error) {
					console.error("Direct scraper run failed:", error);
				}
			})(),
		);

		return c.json({
			success: true,
			message: "Direct scraper run started (check logs for progress)",
			mode: "direct",
			limits: {
				repos: `${maxRepos} repos for processing`,
				issues: `${maxReposForIssues} repos for issue fetching, ${maxIssuesPerRepo} issues per repo`,
			},
			note: "This runs all workflow logic directly without using Cloudflare Workflows",
		});
	} catch (error) {
		console.error("Failed to start direct scraper:", error);
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

// Run scraper directly and wait for completion (blocking)
app.get("/test-scraper-direct-blocking", async (c) => {
	try {
		console.log("Starting direct scraper run (blocking)...");

		// Get optional limits from query params
		const maxRepos = c.req.query("maxRepos")
			? parseInt(c.req.query("maxRepos")!)
			: 6;
		const maxReposForIssues = c.req.query("maxReposForIssues")
			? parseInt(c.req.query("maxReposForIssues")!)
			: 3;
		const maxIssuesPerRepo = c.req.query("maxIssuesPerRepo")
			? parseInt(c.req.query("maxIssuesPerRepo")!)
			: 10;

		const { runScraperDirect } = await import("@/scrapers/run-direct");
		const stats = await runScraperDirect(c.env, {
			maxRepos,
			maxReposForIssues,
			maxIssuesPerRepo,
		});

		return c.json({
			success: true,
			message: "Direct scraper run completed",
			limits: {
				repos: `${maxRepos} repos processed`,
				issues: `${maxReposForIssues} repos for issues, ${maxIssuesPerRepo} issues per repo`,
			},
			stats,
		});
	} catch (error) {
		console.error("Direct scraper run failed:", error);

		// Special handling for authentication errors
		if (
			error instanceof Error &&
			error.message.includes("authentication failed")
		) {
			return c.json(
				{
					success: false,
					error: "GitHub authentication failed",
					message: error.message,
					hint: "Check your GITHUB_SCRAPER_TOKEN in .dev.vars file. Make sure it's a valid GitHub Personal Access Token with 'public_repo' scope.",
				},
				403,
			);
		}

		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
			},
			500,
		);
	}
});

// List all workflow instances (if needed for debugging)
app.get("/workflows", async (c) => {
	return c.json({
		success: true,
		message:
			"Use the Cloudflare dashboard or Workflows REST API to list all instances",
		endpoints: {
			startWorkflow: "GET /test-scraper",
			startDirect: "GET /test-scraper-direct",
			startDirectBlocking: "GET /test-scraper-direct-blocking",
			status: "GET /workflow/:instanceId/status",
			stop: "POST /workflow/:instanceId/stop",
		},
	});
});
