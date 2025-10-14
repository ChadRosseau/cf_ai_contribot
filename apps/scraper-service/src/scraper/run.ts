/**
 * Main scraper logic for scraper-service
 * Fetches repos and issues metadata, compares hashes, queues for processing
 */

import { initDatabase } from "@repo/data-ops/database/setup";
import { GitHubApiClient } from "../utils/github-api";
import { AdapterRegistry, DATA_SOURCE_CONFIGS } from "./adapters/registry";
import { MetadataProcessor } from "./processors/metadata-processor";
import type { RepoSourceData } from "./adapters/base-adapter";

export interface ScraperRunStats {
	repos: {
		processed: number;
		new: number;
		updated: number;
		unchanged: number;
		queued: number;
		errors: number;
	};
	issues: {
		processed: number;
		new: number;
		updated: number;
		unchanged: number;
		queued: number;
		errors: number;
	};
	duration: number;
	completed: boolean;
	continuationQueued: boolean;
}

export async function runScraper(
	env: Env,
	startFromCursor?: ScraperCursor,
): Promise<ScraperRunStats> {
	console.log("=== Starting Scraper Run ===");
	const startTime = Date.now();

	const db = initDatabase(env.DB);
	const githubClient = new GitHubApiClient(env.GITHUB_SCRAPER_TOKEN);
	const adapterRegistry = new AdapterRegistry();
	const processor = new MetadataProcessor(
		db as any,
		githubClient,
		env.PROCESSING_QUEUE,
	);

	let completed = true;
	let continuationQueued = false;

	// Step 1: Fetch repos from data sources
	console.log("\n[Step 1] Fetching repos from data sources...");
	const allRepoData: RepoSourceData[] = [];

	for (const config of DATA_SOURCE_CONFIGS) {
		if (!config.enabled) {
			console.log(`Skipping disabled data source: ${config.id}`);
			continue;
		}

		// Skip if we're resuming and haven't reached the cursor yet
		if (startFromCursor && config.id !== startFromCursor.dataSourceId) {
			console.log(`Skipping ${config.id} (before cursor)`);
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

			// Check for subrequest limit
			if (
				error instanceof Error &&
				error.message.includes("too many subrequests")
			) {
				console.error("⛔ Hit subrequest limit while fetching data sources");
				throw error;
			}
		}
	}

	console.log(`Total repos from all sources: ${allRepoData.length}`);

	// Apply cursor if resuming
	const startIndex = startFromCursor ? startFromCursor.lastRepoIndex + 1 : 0;
	const reposToProcess =
		startIndex > 0 ? allRepoData.slice(startIndex) : allRepoData;

	if (startFromCursor) {
		console.log(
			`Resuming from index ${startIndex} (${reposToProcess.length} repos remaining)`,
		);
	}

	// Step 2: Process repos and issues
	console.log("\n[Step 2] Processing repos and issues...");
	try {
		// Process repos (this also processes issues for each repo)
		for (let i = 0; i < reposToProcess.length; i++) {
			const repo = reposToProcess[i];
			const actualIndex = startIndex + i;

			try {
				await processor.processRepos([repo]);
			} catch (error) {
				console.error(`Error processing ${repo.owner}/${repo.name}:`, error);

				// Check for subrequest limit or D1 failures
				if (
					error instanceof Error &&
					(error.message.includes("too many subrequests") ||
						error.message.includes("Too many subrequests") ||
						(error.message.includes("Failed query") &&
							error.message.includes("network")))
				) {
					console.log(
						`⛔ Hit subrequest/D1 limit at repo ${actualIndex}/${allRepoData.length}`,
					);
					console.log(`Error: ${error.message}`);

					// Queue continuation - will be picked up by the queue consumer
					const cursor: ScraperCursor = {
						lastRepoIndex: actualIndex,
						dataSourceId: repo.dataSourceId,
					};

					try {
						await env.SCRAPER_CONTINUATION_QUEUE.send({
							type: "continue_scraping",
							cursor,
							priority: 1000, // Very high priority
						});

						console.log(`✓ Queued continuation from index ${actualIndex}`);
						completed = false;
						continuationQueued = true;
					} catch (queueError) {
						console.error("Failed to queue continuation:", queueError);
						console.warn("⚠️ Scraper will not continue automatically");
					}

					break; // Stop processing immediately
				}

				throw error; // Other errors
			}
		}

		const stats = processor.getStats();
		console.log("Scraping complete:", stats);

		return {
			...stats,
			duration: Date.now() - startTime,
			completed,
			continuationQueued,
		};
	} catch (error) {
		console.error("Scraper run failed:", error);
		throw error;
	}
}
