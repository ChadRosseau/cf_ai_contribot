/**
 * Scraper Service - Worker Entry Point
 * Fetches repos and issues metadata, queues items for processing
 */

import { Hono } from "hono";
import { R2Logger, WorkflowLogger } from "@repo/r2-logger";
import { runDiscovery } from "./discovery/run";

// HTTP API for manual triggering
const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
	return c.json({
		service: "contribot-scraper-service (Discovery Service)",
		version: "2.0.0",
		description:
			"Discovers repos from data sources and queues them for processing",
		endpoints: {
			trigger: "POST /trigger - Manually trigger discovery run",
			health: "GET /health - Health check",
		},
	});
});

app.get("/health", (c) => {
	return c.json({ status: "healthy", service: "scraper-service" });
});

app.post("/trigger", async (c) => {
	console.log("=== Manual Trigger: Discovery Service ===");
	console.log("Time:", new Date().toISOString());

	// Initialize R2 logging
	const loggingEnabled = c.env.ENABLE_R2_LOGGING === "true";
	const runId = `manual-${Date.now()}`;
	const r2Logger = new R2Logger(
		c.env.WORKFLOW_LOGS,
		loggingEnabled,
		runId,
		"discovery-service",
	);
	const logger = new WorkflowLogger(r2Logger);

	logger.startCapture();

	try {
		console.log("Starting discovery run...");
		const stats = await runDiscovery(c.env);

		console.log("\n=== Discovery Run Complete ===");
		console.log("Stats:", stats);

		// Flush logs to R2
		logger.stopCapture();
		await logger.flush();

		return c.json({
			success: true,
			runId,
			stats,
			message: "Discovery run completed successfully",
		});
	} catch (error) {
		console.error("Discovery run failed:", error);

		// Flush logs even on error
		logger.stopCapture();
		await logger.flush();

		// Check for auth errors
		if (error instanceof Error && error.message.includes("authentication")) {
			return c.json(
				{
					success: false,
					runId,
					message: "GitHub authentication failed. Please check your token.",
				},
				401,
			);
		}

		// Generic error - don't expose details
		return c.json(
			{
				success: false,
				runId,
				message: "Discovery run failed. Check R2 logs for details.",
			},
			500,
		);
	}
});

// Scheduled trigger (cron)
const scheduled: ExportedHandlerScheduledHandler<Env> = async (
	controller,
	env,
	ctx,
) => {
	console.log("=== Cron Triggered: Discovery Service ===");
	console.log("Time:", new Date().toISOString());
	console.log("Cron pattern:", controller.cron);

	// Initialize R2 logging
	const loggingEnabled = env.ENABLE_R2_LOGGING === "true";
	const runId = `cron-${Date.now()}`;
	const r2Logger = new R2Logger(
		env.WORKFLOW_LOGS,
		loggingEnabled,
		runId,
		"discovery-service",
	);
	const logger = new WorkflowLogger(r2Logger);

	logger.startCapture();

	try {
		console.log("Starting discovery run...");
		const stats = await runDiscovery(env);

		console.log("\n=== Discovery Run Complete ===");
		console.log("Stats:", stats);

		// Flush logs to R2
		logger.stopCapture();
		await logger.flush();
	} catch (error) {
		console.error(
			"❌ Discovery run failed:",
			error instanceof Error ? error.message : String(error),
		);

		// Flush logs even on error
		logger.stopCapture();
		await logger.flush();
	}
};

// No queue consumer needed in discovery service!
// Queue consumer is in data-service

export default {
	fetch: app.fetch,
	scheduled,
};
