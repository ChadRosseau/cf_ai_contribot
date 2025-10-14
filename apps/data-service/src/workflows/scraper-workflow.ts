/**
 * Scraper Workflow
 * Orchestrates the entire scraping process as a Cloudflare Workflow
 * Steps:
 * 1. Fetch repos from data sources
 * 2. Process repos (hash comparison, deduplication)
 * 3. Process issues for repos
 * 4. Run AI queue processing
 */

import {
	WorkflowEntrypoint,
	WorkflowEvent,
	WorkflowStep,
} from "cloudflare:workers";
import { initDatabase } from "@repo/data-ops/database/setup";
import { GitHubApiClient } from "../utils/github-api";
import {
	AdapterRegistry,
	DATA_SOURCE_CONFIGS,
} from "../scrapers/adapters/registry";
import { RepoProcessor } from "../scrapers/processors/repo-processor";
import {
	IssueProcessor,
	type RepoInfo,
} from "../scrapers/processors/issue-processor";
import { getAllRepos } from "@repo/data-ops/queries/repos";
import { processAiQueueBatch } from "../ai/queue-processor";
import type { RepoSourceData } from "../scrapers/adapters/base-adapter";
import { R2Logger } from "../utils/r2-logger";
import { WorkflowLogger } from "../utils/workflow-logger";

export interface ScraperWorkflowParams {
	triggeredAt: string;
}

export class ScraperWorkflow extends WorkflowEntrypoint<
	Env,
	ScraperWorkflowParams
> {
	async run(
		event: Readonly<WorkflowEvent<ScraperWorkflowParams>>,
		step: WorkflowStep,
	) {
		// Initialize R2 logging
		const loggingEnabled = this.env.ENABLE_R2_LOGGING === "true";
		const runId = `workflow-${Date.now()}`;
		const r2Logger = new R2Logger(
			this.env.WORKFLOW_LOGS,
			loggingEnabled,
			runId,
		);
		const logger = new WorkflowLogger(r2Logger);

		// Start capturing console output
		logger.startCapture();

		console.log("=== Scraper Workflow Started ===");
		console.log("Triggered at:", event.payload.triggeredAt);
		console.log("Workflow ID:", runId);
		console.log("R2 Logging:", loggingEnabled ? "enabled" : "disabled");

		const db = initDatabase(this.env.DB);
		const githubClient = new GitHubApiClient(this.env.GITHUB_SCRAPER_TOKEN);
		const adapterRegistry = new AdapterRegistry();

		// Step 1: Fetch repos from all data sources
		const repoDataList = await step.do<RepoSourceData[]>(
			"fetch-repos-from-sources",
			async () => {
				logger.startStep("fetch-repos-from-sources");
				try {
					console.log("Fetching repos from data sources...");
					const allRepoData: RepoSourceData[] = [];

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
							console.log(
								`✓ Fetched ${repoData.length} repos from ${adapter.name}`,
							);
						} catch (error) {
							console.error(`Error fetching from ${adapter.name}:`, error);
						}
					}

					console.log(`Total repos from all sources: ${allRepoData.length}`);
					logger.endStep("fetch-repos-from-sources", {
						count: allRepoData.length,
					});
					await logger.flushKeep();
					return allRepoData;
				} catch (error) {
					logger.stepError("fetch-repos-from-sources", error);
					await logger.flushKeep();
					throw error;
				}
			},
		);

		// Step 2: Process repos in batches (to avoid subrequest limits)
		const BATCH_SIZE = 30; // Process 30 repos per workflow step
		const batches: RepoSourceData[][] = [];
		for (let i = 0; i < repoDataList.length; i += BATCH_SIZE) {
			batches.push(repoDataList.slice(i, i + BATCH_SIZE));
		}

		console.log(
			`Processing ${repoDataList.length} repos in ${batches.length} batches of ${BATCH_SIZE}...`,
		);

		let repoStats = {
			processed: 0,
			new: 0,
			updated: 0,
			unchanged: 0,
			errors: 0,
		};

		for (let i = 0; i < batches.length; i++) {
			const batchStats = await step.do(
				`process-repos-batch-${i + 1}`,
				async () => {
					logger.startStep(`process-repos-batch-${i + 1}`);
					try {
						console.log(
							`Processing batch ${i + 1}/${batches.length} (${batches[i].length} repos)...`,
						);
						const processor = new RepoProcessor(db as any, githubClient);
						const stats = await processor.process(batches[i]);
						logger.endStep(`process-repos-batch-${i + 1}`, stats);
						await logger.flushKeep();
						return stats;
					} catch (error) {
						logger.stepError(`process-repos-batch-${i + 1}`, error);
						await logger.flushKeep();
						throw error;
					}
				},
			);

			// Aggregate stats
			repoStats.processed += batchStats.processed;
			repoStats.new += batchStats.new;
			repoStats.updated += batchStats.updated;
			repoStats.unchanged += batchStats.unchanged;
			repoStats.errors += batchStats.errors;
		}

		console.log("Repo processing stats (all batches):", repoStats);

		// Step 3: Get all repos for issue processing
		const reposToProcess = await step.do<RepoInfo[]>(
			"fetch-repos-for-issues",
			async () => {
				logger.startStep("fetch-repos-for-issues");
				try {
					const allRepos = await getAllRepos(db as any);
					const result = allRepos.map((repo) => ({
						id: repo.id,
						owner: repo.owner,
						name: repo.name,
						goodFirstIssueTag: repo.goodFirstIssueTag,
					}));
					logger.endStep("fetch-repos-for-issues", { count: result.length });
					await logger.flushKeep();
					return result;
				} catch (error) {
					logger.stepError("fetch-repos-for-issues", error);
					await logger.flushKeep();
					throw error;
				}
			},
		);

		// Step 4: Process issues in batches (to avoid subrequest limits)
		// Each repo can make up to 100 API calls (10,000 issues / 100 per page)
		// Most repos have < 5 pages, so we batch conservatively
		const ISSUE_BATCH_SIZE = 3; // Process issues for 3 repos per workflow step
		const issueBatches: RepoInfo[][] = [];
		for (let i = 0; i < reposToProcess.length; i += ISSUE_BATCH_SIZE) {
			issueBatches.push(reposToProcess.slice(i, i + ISSUE_BATCH_SIZE));
		}

		console.log(
			`Processing issues for ${reposToProcess.length} repos in ${issueBatches.length} batches of ${ISSUE_BATCH_SIZE}...`,
		);

		let issueStats = {
			processed: 0,
			new: 0,
			updated: 0,
			unchanged: 0,
			errors: 0,
		};

		for (let i = 0; i < issueBatches.length; i++) {
			const batchStats = await step.do(
				`process-issues-batch-${i + 1}`,
				async () => {
					logger.startStep(`process-issues-batch-${i + 1}`);
					try {
						console.log(
							`Processing issues batch ${i + 1}/${issueBatches.length} (${issueBatches[i].length} repos)...`,
						);
						const processor = new IssueProcessor(db as any, githubClient);
						const stats = await processor.processRepos(issueBatches[i]);
						logger.endStep(`process-issues-batch-${i + 1}`, stats);
						await logger.flushKeep();
						return stats;
					} catch (error) {
						logger.stepError(`process-issues-batch-${i + 1}`, error);
						await logger.flushKeep();
						throw error;
					}
				},
			);

			// Aggregate stats
			issueStats.processed += batchStats.processed;
			issueStats.new += batchStats.new;
			issueStats.updated += batchStats.updated;
			issueStats.unchanged += batchStats.unchanged;
			issueStats.errors += batchStats.errors;
		}

		console.log("Issue processing stats (all batches):", issueStats);

		// Step 5: Get GitHub API stats
		const githubStats = githubClient.getRateLimitStats();
		console.log("GitHub API stats:", githubStats);

		// Step 6: Process AI queue in batches (to avoid subrequest limits)
		// Each AI item = 1 AI call + ~5 DB queries = ~6 subrequests per item
		const MAX_AI_BATCHES = 30; // Max 30 batches
		const AI_BATCH_SIZE = 8; // 8 items per batch (8 * 6 = 48 subrequests)

		console.log("Processing AI queue in batches...");

		let aiStats = {
			processed: 0,
			success: 0,
			failed: 0,
			remaining: 0,
		};

		let batchNum = 0;
		let hasMore = true;

		while (hasMore && batchNum < MAX_AI_BATCHES) {
			batchNum++;

			const result = await step.do(
				`process-ai-queue-batch-${batchNum}`,
				async () => {
					logger.startStep(`process-ai-queue-batch-${batchNum}`);
					try {
						console.log(`Processing AI queue batch ${batchNum}...`);
						const result = await processAiQueueBatch(
							db as any,
							this.env.AI,
							AI_BATCH_SIZE,
						);
						logger.endStep(`process-ai-queue-batch-${batchNum}`, result.stats);
						await logger.flushKeep();
						return result;
					} catch (error) {
						logger.stepError(`process-ai-queue-batch-${batchNum}`, error);
						await logger.flushKeep();
						throw error;
					}
				},
			);

			// Aggregate stats
			aiStats.processed += result.stats.processed;
			aiStats.success += result.stats.success;
			aiStats.failed += result.stats.failed;
			aiStats.remaining = result.stats.remaining;
			hasMore = result.hasMore;

			if (!hasMore) {
				console.log("AI queue is empty");
				break;
			}
		}

		if (batchNum >= MAX_AI_BATCHES && hasMore) {
			console.log(
				`Reached max AI batches (${MAX_AI_BATCHES}). ${aiStats.remaining} items remaining for next run.`,
			);
		}

		console.log("AI processing stats (all batches):", aiStats);

		// Step 7: Log final summary
		await step.do("log-summary", async () => {
			logger.startStep("log-summary");
			try {
				console.log("\n=== Scraper Workflow Complete ===");
				console.log("Summary:");
				console.log("  Repos:", repoStats);
				console.log("  Issues:", issueStats);
				console.log("  AI Processing:", aiStats);
				console.log("  GitHub API Requests:", {
					made: githubStats.requestsThisHour,
					remaining: githubStats.remaining,
					maxPerHour: githubStats.maxPerHour,
				});

				const summary = {
					repos: repoStats,
					issues: issueStats,
					aiProcessing: aiStats,
					githubRequests: {
						made: githubStats.requestsThisHour,
						remaining: githubStats.remaining,
						maxPerHour: githubStats.maxPerHour,
					},
				};

				logger.endStep("log-summary", summary);
			} catch (error) {
				logger.stepError("log-summary", error);
			}
		});

		// Final flush of all logs to R2
		logger.stopCapture();
		await logger.flush();
		console.log("Workflow logs flushed to R2");
	}
}
