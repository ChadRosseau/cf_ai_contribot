/**
 * Data Service - Queue Consumer Entry Point
 * Processes repos and issues by fetching data and generating AI summaries
 */

import { R2Logger, WorkflowLogger } from "@repo/r2-logger";
import { initDatabase } from "@repo/data-ops/database/setup";
import { GitHubApiClient } from "./utils/github-api";
import { AiSummarizer } from "./ai/summarizer";
import { RepoProcessor } from "./processor/repo-processor";
import { IssueProcessor } from "./processor/issue-processor";

// Queue consumer handler
const queue: ExportedHandlerQueueHandler<Env, ProcessingQueueMessage> = async (
	batch,
	env,
	ctx,
) => {
	console.log("=== Queue Consumer: Data Service ===");
	console.log(`Processing batch of ${batch.messages.length} messages`);

	// Initialize R2 logging
	const loggingEnabled = env.ENABLE_R2_LOGGING === "true";
	const batchId = `batch-${Date.now()}`;
	const r2Logger = new R2Logger(
		env.WORKFLOW_LOGS,
		loggingEnabled,
		batchId,
		"data-service",
	);
	const logger = new WorkflowLogger(r2Logger);

	logger.startCapture();

	// Initialize shared services
	const db = initDatabase(env.DB);
	const githubClient = new GitHubApiClient(env.GITHUB_SCRAPER_TOKEN);
	const aiSummarizer = new AiSummarizer(env.AI);
	const repoProcessor = new RepoProcessor(
		db as any,
		githubClient,
		aiSummarizer,
		env.PROCESSING_QUEUE,
	);
	const issueProcessor = new IssueProcessor(
		db as any,
		githubClient,
		aiSummarizer,
	);

	for (const message of batch.messages) {
		try {
			const msg = message.body;

			if (msg.type === "process_repo") {
				console.log(`\nProcessing repo #${msg.repoId}...`);
				const stats = await repoProcessor.processRepo(msg.repoId);
				console.log(`✓ Repo processing stats:`, stats);
				message.ack();
			} else if (msg.type === "process_issue") {
				console.log(`\nProcessing issue #${msg.issueId}...`);
				const stats = await issueProcessor.processIssue(msg.issueId);
				console.log(`✓ Issue processing stats:`, stats);
				message.ack();
			} else {
				console.warn(`Unknown message type: ${(msg as any).type}`);
				message.ack();
			}
		} catch (error) {
			console.error("❌ Failed to process message:", error);

			// Check for subrequest limit - terminate and retry
			if (
				error instanceof Error &&
				(error.message.includes("too many subrequests") ||
					error.message.includes("Too many subrequests") ||
					error.message.includes("Failed query"))
			) {
				console.log(
					"⚠️ Hit subrequest limit - terminating and retrying message in new invocation",
				);
				logger.stopCapture();
				await logger.flush();
				message.retry();
				// Terminate processing this batch
				return;
			}

			// Other errors - log and ack to prevent infinite retries
			console.error("❌ Non-retriable error, acking message");
			message.ack();
		}
	}

	// Flush logs
	logger.stopCapture();
	await logger.flush();

	console.log("✓ Batch processing complete");
};

export default {
	queue,
};
