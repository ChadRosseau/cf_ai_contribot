/**
 * Discovery Service - Main Logic
 * Fetches repos from data sources, updates DB, queues for processing
 */

import { initDatabase } from "@repo/data-ops/database/setup";
import { GitHubApiClient } from "../utils/github-api";
import { AdapterRegistry, DATA_SOURCE_CONFIGS } from "../scraper/adapters/registry";
import { DiscoveryProcessor } from "./processor";
import type { RepoSourceData } from "../scraper/adapters/base-adapter";

export interface DiscoveryRunStats {
	reposDiscovered: number;
	reposNew: number;
	reposUpdated: number;
	reposUnchanged: number;
	reposQueued: number;
	reposErrors: number;
	duration: number;
}

export async function runDiscovery(env: Env): Promise<DiscoveryRunStats> {
	console.log("=== Starting Repository Discovery ===");
	const startTime = Date.now();

	const db = initDatabase(env.DB);
	const githubClient = new GitHubApiClient(env.GITHUB_SCRAPER_TOKEN);
	const adapterRegistry = new AdapterRegistry();
	const processor = new DiscoveryProcessor(db as any, githubClient, env.PROCESSING_QUEUE);

	// Step 1: Fetch repos from all data sources
	console.log("\n[Step 1] Fetching repos from data sources...");
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
			console.log(`✓ Fetched ${repoData.length} repos from ${adapter.name}`);
		} catch (error) {
			console.error(`Error fetching from ${adapter.name}:`, error);
			// Continue with other sources even if one fails
		}
	}

	console.log(`Total repos from all sources: ${allRepoData.length}`);

	// Step 2: Discover repos (fetch metadata, update DB, queue)
	console.log("\n[Step 2] Discovering and queueing repos...");
	const stats = await processor.processRepos(allRepoData);

	console.log("\n=== Discovery Complete ===");
	console.log("Stats:", stats);

	return {
		...stats,
		duration: Date.now() - startTime,
	};
}

