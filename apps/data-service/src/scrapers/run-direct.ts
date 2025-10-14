/**
 * Run scraper logic directly without workflows
 * Useful for local testing and debugging
 */

import { initDatabase } from "@repo/data-ops/database/setup";
import { GitHubApiClient } from "../utils/github-api";
import { AdapterRegistry, DATA_SOURCE_CONFIGS } from "./adapters/registry";
import { RepoProcessor } from "./processors/repo-processor";
import { IssueProcessor, type RepoInfo } from "./processors/issue-processor";
import { getAllRepos } from "@repo/data-ops/queries/repos";
import { processAiQueue } from "../ai/queue-processor";
import { R2Logger } from "../utils/r2-logger";
import { WorkflowLogger } from "../utils/workflow-logger";

export interface ScraperRunStats {
	repos: {
		processed: number;
		new: number;
		updated: number;
		unchanged: number;
		errors: number;
	};
	issues: {
		processed: number;
		new: number;
		updated: number;
		unchanged: number;
		errors: number;
	};
	aiProcessing: {
		processed: number;
		success: number;
		failed: number;
		remaining: number;
	};
	githubApiRequests: {
		made: number;
		remaining: number;
		maxPerHour: number;
	};
	duration: number;
}

export async function runScraperDirect(
	env: Env,
	options?: {
		maxRepos?: number;
		maxReposForIssues?: number;
		maxIssuesPerRepo?: number;
	},
): Promise<ScraperRunStats> {
	// Initialize R2 logging
	const loggingEnabled = env.ENABLE_R2_LOGGING === "true";
	const runId = `direct-${Date.now()}`;
	const r2Logger = new R2Logger(env.WORKFLOW_LOGS, loggingEnabled, runId);
	const logger = new WorkflowLogger(r2Logger);

	// Start capturing console output
	logger.startCapture();

	console.log("=== Starting Direct Scraper Run ===");
	console.log("Run ID:", runId);
	console.log("R2 Logging:", loggingEnabled ? "enabled" : "disabled");

	if (options?.maxRepos) {
		console.log(`⚠️  Limited to ${options.maxRepos} repos for repo processing`);
	}
	if (options?.maxReposForIssues) {
		console.log(
			`⚠️  Limited to ${options.maxReposForIssues} repos for issue processing`,
		);
	}
	if (options?.maxIssuesPerRepo) {
		console.log(`⚠️  Limited to ${options.maxIssuesPerRepo} issues per repo`);
	}
	const startTime = Date.now();

	const db = initDatabase(env.DB);
	const githubClient = new GitHubApiClient(env.GITHUB_SCRAPER_TOKEN);
	const adapterRegistry = new AdapterRegistry();

	// Step 1: Fetch repos from all data sources
	logger.startStep("fetch-repos-from-sources");
	console.log("\n[Step 1] Fetching repos from data sources...");
	const allRepoData = [];

	try {
		for (const config of DATA_SOURCE_CONFIGS) {
			if (!config.enabled) {
				console.log(`Skipping disabled data source: ${config.id}`);
				continue;
			}

			const adapter = adapterRegistry.get(config.id);
			if (!adapter) {
				console.warn(`No adapter found for data source: ${config.id}`);
				continue;
			}

			try {
				console.log(`Fetching from ${adapter.name}...`);
				const repoData = await adapter.fetch(config.url);
				allRepoData.push(...repoData);
				console.log(`✓ Fetched ${repoData.length} repos from ${adapter.name}`);
			} catch (error) {
				console.error(`Error fetching from ${adapter.name}:`, error);
			}
		}

		console.log(`Total repos from all sources: ${allRepoData.length}`);
		logger.endStep("fetch-repos-from-sources", { count: allRepoData.length });
		await logger.flushKeep();
	} catch (error) {
		logger.stepError("fetch-repos-from-sources", error);
		await logger.flushKeep();
		throw error;
	}

	// Apply limit if specified
	const reposToProcess = options?.maxRepos
		? allRepoData.slice(0, options.maxRepos)
		: allRepoData;

	if (options?.maxRepos && reposToProcess.length < allRepoData.length) {
		console.log(
			`⚠️  Processing only ${reposToProcess.length} of ${allRepoData.length} repos`,
		);
	}

	// Step 2: Process repos
	logger.startStep("process-repos");
	console.log("\n[Step 2] Processing repos...");
	const repoProcessor = new RepoProcessor(db as any, githubClient);
	let repoStats;

	try {
		repoStats = await repoProcessor.process(reposToProcess);
		console.log("Repo processing stats:", repoStats);
		logger.endStep("process-repos", repoStats);
		await logger.flushKeep();
	} catch (error) {
		logger.stepError("process-repos", error);
		await logger.flushKeep();

		// If authentication fails, stop immediately
		if (
			error instanceof Error &&
			error.message.includes("authentication failed")
		) {
			console.error("\n❌ AUTHENTICATION FAILED ❌");
			console.error(error.message);
			console.error(
				"\nPlease fix your GitHub token in .dev.vars and try again.",
			);

			// Final flush before stopping
			logger.stopCapture();
			await logger.flush();
			throw error;
		}
		throw error;
	}

	// Step 3: Get all repos for issue processing
	logger.startStep("fetch-repos-for-issues");
	console.log("\n[Step 3] Fetching repos for issue processing...");

	try {
		const allRepos = await getAllRepos(db as any);
		let reposForIssues: RepoInfo[] = allRepos.map((repo) => ({
			id: repo.id,
			owner: repo.owner,
			name: repo.name,
			goodFirstIssueTag: repo.goodFirstIssueTag,
		}));

		// Apply limit for issue processing if specified
		if (
			options?.maxReposForIssues &&
			reposForIssues.length > options.maxReposForIssues
		) {
			console.log(
				`⚠️  Processing issues for only ${options.maxReposForIssues} of ${reposForIssues.length} repos`,
			);
			reposForIssues = reposForIssues.slice(0, options.maxReposForIssues);
		}

		logger.endStep("fetch-repos-for-issues", { count: reposForIssues.length });
		await logger.flushKeep();

		// Step 4: Process issues
		logger.startStep("process-issues");
		console.log("\n[Step 4] Processing issues...");
		const issueProcessor = new IssueProcessor(db as any, githubClient);
		const issueStats = await issueProcessor.processRepos(
			reposForIssues,
			options?.maxIssuesPerRepo,
		);
		console.log("Issue processing stats:", issueStats);
		logger.endStep("process-issues", issueStats);
		await logger.flushKeep();

		// Step 5: Get GitHub API stats
		const githubStats = githubClient.getRateLimitStats();
		console.log("\n[Step 5] GitHub API stats:", githubStats);

		// Step 6: Process AI queue
		logger.startStep("process-ai-queue");
		console.log("\n[Step 6] Processing AI queue...");
		const aiStats = await processAiQueue(db as any, env.AI);
		console.log("AI processing stats:", aiStats);
		logger.endStep("process-ai-queue", aiStats);
		await logger.flushKeep();

		const duration = Date.now() - startTime;
		console.log(`\n=== Direct Scraper Run Complete (${duration}ms) ===`);

		// Final flush and cleanup
		logger.stopCapture();
		await logger.flush();
		console.log("Logs flushed to R2");

		return {
			repos: repoStats,
			issues: issueStats,
			aiProcessing: aiStats,
			githubApiRequests: githubStats,
			duration,
		};
	} catch (error) {
		logger.stepError("fetch-repos-for-issues", error);
		await logger.flushKeep();

		// Final flush before rethrowing
		logger.stopCapture();
		await logger.flush();
		throw error;
	}
}
