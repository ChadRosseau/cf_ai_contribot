/**
 * Repository Discovery Processor
 * Discovers repos from data sources, fetches metadata, updates DB, queues for processing
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { GitHubApiClient } from "../utils/github-api";
import { hashRepoMetadata } from "../utils/hash";
import {
	findRepoByOwnerName,
	insertRepo,
	updateRepo,
	type CreateRepoData,
	type UpdateRepoData,
} from "@repo/data-ops/queries/repos";
import type { RepoSourceData } from "../scraper/adapters/base-adapter";

export interface DiscoveryStats {
	reposDiscovered: number;
	reposNew: number;
	reposUpdated: number;
	reposUnchanged: number;
	reposQueued: number;
	reposErrors: number;
}

export class DiscoveryProcessor {
	private db: DrizzleD1Database;
	private githubClient: GitHubApiClient;
	private queue: Queue<ProcessingQueueMessage>;
	private stats: DiscoveryStats = {
		reposDiscovered: 0,
		reposNew: 0,
		reposUpdated: 0,
		reposUnchanged: 0,
		reposQueued: 0,
		reposErrors: 0,
	};

	constructor(
		db: DrizzleD1Database,
		githubClient: GitHubApiClient,
		queue: Queue<ProcessingQueueMessage>,
	) {
		this.db = db;
		this.githubClient = githubClient;
		this.queue = queue;
	}

	/**
	 * Process discovered repos
	 */
	async processRepos(repos: RepoSourceData[]): Promise<DiscoveryStats> {
		console.log(`Discovering ${repos.length} repos...`);

		for (const repo of repos) {
			try {
				await this.processRepo(repo);
			} catch (error) {
				console.error(
					`Error discovering repo ${repo.owner}/${repo.name}:`,
					error,
				);

				// Check for auth failure - fatal error
				if (error instanceof Error && error.message.includes("Forbidden")) {
					console.error("❌ GitHub authentication failed");
					throw new Error(
						"GitHub authentication failed: Invalid or expired token",
					);
				}

				this.stats.reposErrors++;
			}
		}

		return this.stats;
	}

	/**
	 * Process a single repo
	 */
	private async processRepo(sourceData: RepoSourceData): Promise<void> {
		this.stats.reposDiscovered++;

		// 1. Fetch label-specific issue count from GitHub GraphQL
		console.log(
			`Fetching issue count for ${sourceData.owner}/${sourceData.name} (label: "${sourceData.goodFirstIssueTag}")...`,
		);
		let labelCount;
		try {
			labelCount = await this.githubClient.fetchIssueLabelCount(
				sourceData.owner,
				sourceData.name,
				sourceData.goodFirstIssueTag,
			);
		} catch (error) {
			console.error(
				`Failed to fetch issue count for ${sourceData.owner}/${sourceData.name}:`,
				error,
			);
			throw error;
		}

		// 2. Check if repo exists in DB
		const existingRepo = await findRepoByOwnerName(
			this.db as any,
			sourceData.owner,
			sourceData.name,
		);

		// 3. Calculate metadata hash (only source metadata, not GitHub data)
		const metadataHash = await hashRepoMetadata(
			sourceData.owner,
			sourceData.name,
			sourceData.goodFirstIssueTag,
			sourceData.dataSourceId,
		);

		const githubUrl = `https://github.com/${sourceData.owner}/${sourceData.name}`;

		if (!existingRepo) {
			// New repo - insert and queue
			const newRepo: CreateRepoData = {
				owner: sourceData.owner,
				name: sourceData.name,
				githubUrl,
				languagesOrdered: null, // Will be filled by data-service
				languagesRaw: null, // Will be filled by data-service
				goodFirstIssueTag: sourceData.goodFirstIssueTag,
				dataSourceId: sourceData.dataSourceId,
				openIssuesCount: labelCount.openCount,
				metadataHash,
			};

			const insertedRepo = await insertRepo(this.db as any, newRepo);
			this.stats.reposNew++;
			console.log(
				`✓ New repo discovered: ${sourceData.owner}/${sourceData.name} (${labelCount.openCount} open "${sourceData.goodFirstIssueTag}" issues)`,
			);

			// Queue for processing
			await this.queue.send({
				type: "process_repo",
				repoId: insertedRepo.id,
			});
			this.stats.reposQueued++;
			console.log(`  → Queued repo ID ${insertedRepo.id} for processing`);
		} else {
			// Repo exists - check if anything changed
			const hashChanged = existingRepo.metadataHash !== metadataHash;
			const issueCountChanged =
				existingRepo.openIssuesCount !== labelCount.openCount;

			if (hashChanged || issueCountChanged) {
				// Something changed - update and queue
				const updateData: UpdateRepoData = {
					goodFirstIssueTag: sourceData.goodFirstIssueTag,
					dataSourceId: sourceData.dataSourceId,
					openIssuesCount: labelCount.openCount,
					metadataHash,
				};

				await updateRepo(this.db as any, existingRepo.id, updateData);
				this.stats.reposUpdated++;

				const reasons = [];
				if (hashChanged) reasons.push("metadata changed");
				if (issueCountChanged) {
					reasons.push(
						`issue count changed (${existingRepo.openIssuesCount} → ${labelCount.openCount})`,
					);
				}
				console.log(
					`✓ Updated repo ID ${existingRepo.id}: ${sourceData.owner}/${sourceData.name} (${reasons.join(", ")})`,
				);

				// Queue for reprocessing
				await this.queue.send({
					type: "process_repo",
					repoId: existingRepo.id,
				});
				this.stats.reposQueued++;
				console.log(`  → Queued repo ID ${existingRepo.id} for reprocessing`);
			} else {
				// No changes - skip
				this.stats.reposUnchanged++;
				console.log(
					`- Skipped repo ID ${existingRepo.id}: ${sourceData.owner}/${sourceData.name} (no changes)`,
				);
			}
		}
	}

	getStats(): DiscoveryStats {
		return this.stats;
	}
}
