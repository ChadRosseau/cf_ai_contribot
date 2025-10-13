/**
 * Repo processor - handles hash comparison and deduplication
 * Updates repos in D1 and enqueues them for AI processing when changed
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { RepoSourceData } from "../adapters/base-adapter";
import { GitHubApiClient } from "../../utils/github-api";
import { hashRepoMetadata } from "../../utils/hash";
import {
	findRepoByOwnerName,
	createRepo,
	updateRepo,
	type CreateRepoData,
	type UpdateRepoData,
} from "@repo/data-ops/queries/repos";
import { enqueueRepo } from "@repo/data-ops/queries/ai-queue";

export interface RepoProcessorStats {
	processed: number;
	new: number;
	updated: number;
	unchanged: number;
	errors: number;
}

export class RepoProcessor {
	private db: DrizzleD1Database;
	private githubClient: GitHubApiClient;
	private stats: RepoProcessorStats = {
		processed: 0,
		new: 0,
		updated: 0,
		unchanged: 0,
		errors: 0,
	};
	private authFailed = false;

	constructor(db: DrizzleD1Database, githubClient: GitHubApiClient) {
		this.db = db;
		this.githubClient = githubClient;
	}

	async process(repos: RepoSourceData[]): Promise<RepoProcessorStats> {
		console.log(`Processing ${repos.length} repos...`);

		for (const repo of repos) {
			// Stop immediately if authentication failed
			if (this.authFailed) {
				console.error("⛔ Stopping processing due to authentication failure");
				break;
			}

			try {
				await this.processRepo(repo);
			} catch (error) {
				console.error(`Error processing repo ${repo.owner}/${repo.name}:`, error);
				
				// Check if it's a 403 Forbidden error
				if (error instanceof Error && error.message.includes("Forbidden")) {
					console.error("❌ GitHub API returned 403 Forbidden - Invalid token");
					console.error("⛔ Stopping all processing to avoid wasting rate limits");
					this.authFailed = true;
					this.stats.errors++;
					throw new Error("GitHub authentication failed: Invalid or expired token. Please check GITHUB_SCRAPER_TOKEN");
				}
				
				this.stats.errors++;
			}
		}

		console.log("Repo processing complete:", this.stats);
		return this.stats;
	}

	private async processRepo(repoData: RepoSourceData): Promise<void> {
		this.stats.processed++;

		// Check if repo exists
		const existingRepo = await findRepoByOwnerName(
			this.db,
			repoData.owner,
			repoData.name
		);

		// Fetch languages from GitHub API
		const languages = await this.githubClient.fetchRepoLanguages(
			repoData.owner,
			repoData.name
		);

		if (languages.ordered.length === 0) {
			console.warn(
				`No languages found for ${repoData.owner}/${repoData.name}, skipping`
			);
			this.stats.errors++;
			return;
		}

		// Compute metadata hash
		const metadataHash = await hashRepoMetadata(
			repoData.owner,
			repoData.name,
			languages.ordered,
			repoData.goodFirstIssueTag
		);

		const githubUrl = `https://github.com/${repoData.owner}/${repoData.name}`;

		if (!existingRepo) {
			// New repo - insert
			await this.createNewRepo({
				owner: repoData.owner,
				name: repoData.name,
				githubUrl,
				languagesOrdered: languages.ordered,
				languagesRaw: languages.raw,
				goodFirstIssueTag: repoData.goodFirstIssueTag,
				dataSourceId: repoData.dataSourceId,
				metadataHash,
			});

			this.stats.new++;
			console.log(`✓ Created new repo: ${repoData.owner}/${repoData.name}`);
		} else {
			// Repo exists - check if hash changed
			if (existingRepo.metadataHash !== metadataHash) {
				// Hash changed - update with new data
				await this.updateExistingRepo(existingRepo.id, {
					languagesOrdered: languages.ordered,
					languagesRaw: languages.raw,
					goodFirstIssueTag: repoData.goodFirstIssueTag,
					dataSourceId: repoData.dataSourceId,
					metadataHash,
				});

				this.stats.updated++;
				console.log(
					`✓ Updated repo: ${repoData.owner}/${repoData.name} (hash changed)`
				);
			} else {
				// Hash unchanged - skip
				this.stats.unchanged++;
				console.log(
					`- Skipped repo: ${repoData.owner}/${repoData.name} (no changes)`
				);
			}
		}
	}

	private async createNewRepo(data: CreateRepoData): Promise<void> {
		const repo = await createRepo(this.db, data);

		// Enqueue for AI processing
		await enqueueRepo(this.db, repo.id);
		console.log(`  → Enqueued repo ${repo.id} for AI processing`);
	}

	private async updateExistingRepo(
		id: number,
		data: UpdateRepoData
	): Promise<void> {
		await updateRepo(this.db, id, data);

		// Enqueue for AI processing (regenerate summary with new data)
		await enqueueRepo(this.db, id);
		console.log(`  → Enqueued repo ${id} for AI processing (re-summarize)`);
	}

	getStats(): RepoProcessorStats {
		return this.stats;
	}
}

