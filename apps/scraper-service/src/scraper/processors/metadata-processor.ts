/**
 * Metadata Processor - scraper-service
 * Handles repos and issues metadata, compares hashes, queues items for processing
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { GitHubApiClient, type GitHubIssue } from "../../utils/github-api";
import { hashRepoMetadata, hashIssueMetadata } from "../../utils/hash";
import {
	findRepoByOwnerName,
	insertRepo,
	updateRepo,
	type CreateRepoData,
	type UpdateRepoData,
} from "@repo/data-ops/queries/repos";
import {
	findIssueByRepoAndNumber,
	createIssue,
	updateIssue,
	batchCreateIssues,
	batchFindIssuesByNumbers,
	type CreateIssueData,
	type UpdateIssueData,
} from "@repo/data-ops/queries/issues";
import type { RepoSourceData } from "../adapters/base-adapter";

export interface MetadataProcessorStats {
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
}

export class MetadataProcessor {
	private db: DrizzleD1Database;
	private githubClient: GitHubApiClient;
	private queue: Queue<QueueMessage>;
	private stats: MetadataProcessorStats = {
		repos: {
			processed: 0,
			new: 0,
			updated: 0,
			unchanged: 0,
			queued: 0,
			errors: 0,
		},
		issues: {
			processed: 0,
			new: 0,
			updated: 0,
			unchanged: 0,
			queued: 0,
			errors: 0,
		},
	};

	constructor(
		db: DrizzleD1Database,
		githubClient: GitHubApiClient,
		queue: Queue<QueueMessage>,
	) {
		this.db = db;
		this.githubClient = githubClient;
		this.queue = queue;
	}

	/**
	 * Process repos and their issues
	 */
	async processRepos(repos: RepoSourceData[]): Promise<MetadataProcessorStats> {
		console.log(`Processing ${repos.length} repos...`);

		for (const repo of repos) {
			try {
				await this.processRepo(repo);
			} catch (error) {
				console.error(
					`Error processing repo ${repo.owner}/${repo.name}:`,
					error,
				);

				// Check for subrequest limit or D1 failure
				if (this.isSubrequestLimitError(error)) {
					console.error(
						"⛔ Hit subrequest/D1 limit - need to queue continuation",
					);
					throw error; // Propagate to trigger continuation logic
				}

				// Check for auth failure
				if (error instanceof Error && error.message.includes("Forbidden")) {
					console.error("❌ GitHub authentication failed");
					throw new Error(
						"GitHub authentication failed: Invalid or expired token",
					);
				}

				this.stats.repos.errors++;
			}
		}

		return this.stats;
	}

	/**
	 * Process a single repo
	 */
	private async processRepo(repoData: RepoSourceData): Promise<void> {
		this.stats.repos.processed++;

		// Check if repo exists
		const existingRepo = await findRepoByOwnerName(
			this.db as any,
			repoData.owner,
			repoData.name,
		);

		// Compute metadata hash (only metadata, no languages)
		const metadataHash = await hashRepoMetadata(
			repoData.owner,
			repoData.name,
			repoData.goodFirstIssueTag,
			repoData.dataSourceId,
		);

		const githubUrl = `https://github.com/${repoData.owner}/${repoData.name}`;

		if (!existingRepo) {
			// New repo - insert with pending status
			const newRepo: CreateRepoData = {
				owner: repoData.owner,
				name: repoData.name,
				githubUrl,
				languagesOrdered: null,
				languagesRaw: null,
				goodFirstIssueTag: repoData.goodFirstIssueTag,
				dataSourceId: repoData.dataSourceId,
				metadataHash,
			};

			const insertedRepo = await insertRepo(this.db as any, newRepo);
			this.stats.repos.new++;
			console.log(`✓ Created new repo: ${repoData.owner}/${repoData.name}`);

			// Queue for processing
			await this.queue.send({
				type: "repo",
				id: insertedRepo.id,
				priority: 100, // High priority for new repos
			});
			this.stats.repos.queued++;
			console.log(`  → Queued repo ${insertedRepo.id} for processing`);
		} else {
			// Repo exists - check if hash changed
			if (existingRepo.metadataHash !== metadataHash) {
				// Hash changed - update metadata and queue for reprocessing
				const updateData: UpdateRepoData = {
					languagesOrdered: null,
					languagesRaw: null,
					goodFirstIssueTag: repoData.goodFirstIssueTag,
					dataSourceId: repoData.dataSourceId,
					metadataHash,
				};

				await updateRepo(this.db as any, existingRepo.id, updateData);
				this.stats.repos.updated++;
				console.log(
					`✓ Updated repo: ${repoData.owner}/${repoData.name} (hash changed)`,
				);

				// Queue for reprocessing
				await this.queue.send({
					type: "repo",
					id: existingRepo.id,
					priority: 50, // Medium priority for updates
				});
				this.stats.repos.queued++;
				console.log(`  → Queued repo ${existingRepo.id} for reprocessing`);
			} else {
				// Hash unchanged - skip
				this.stats.repos.unchanged++;
				console.log(
					`- Skipped repo: ${repoData.owner}/${repoData.name} (no changes)`,
				);
			}
		}

		// Fetch and process issues for this repo
		await this.processRepoIssues(
			existingRepo?.id ||
				(await findRepoByOwnerName(
					this.db as any,
					repoData.owner,
					repoData.name,
				))!.id,
			repoData.owner,
			repoData.name,
			repoData.goodFirstIssueTag,
		);
	}

	/**
	 * Process issues for a repo - using batch operations
	 */
	private async processRepoIssues(
		repoId: number,
		owner: string,
		name: string,
		goodFirstIssueTag: string,
	): Promise<void> {
		console.log(
			`Fetching issues for ${owner}/${name} with label "${goodFirstIssueTag}"`,
		);

		try {
			// Fetch all open issues metadata
			const issues = await this.githubClient.fetchAllIssues(
				owner,
				name,
				goodFirstIssueTag,
				"open",
			);

			// Filter out pull requests
			const actualIssues = issues.filter((issue) => !issue.pull_request);

			console.log(`  Found ${actualIssues.length} open issues`);

			if (actualIssues.length === 0) {
				return;
			}

			// Batch fetch existing issues
			const issueNumbers = actualIssues.map((i) => i.number);
			const existingIssuesMap = await batchFindIssuesByNumbers(
				this.db as any,
				repoId,
				issueNumbers,
			);

			const issuesToCreate: CreateIssueData[] = [];
			const issuesToUpdate: Array<{ id: number; data: UpdateIssueData }> = [];
			const issueIdsToQueue: Array<{ id: number; priority: number }> = [];

			// Process each issue and batch operations
			for (const githubIssue of actualIssues) {
				try {
					const existingIssue = existingIssuesMap.get(githubIssue.number);

					// Extract assignee logins
					const assigneeStatus =
						githubIssue.assignees.length > 0
							? githubIssue.assignees.map((a) => a.login)
							: null;

					// Compute metadata hash
					const metadataHash = await hashIssueMetadata(
						githubIssue.comments,
						githubIssue.state,
						assigneeStatus,
					);

					const githubUrl = `https://github.com/${owner}/${name}/issues/${githubIssue.number}`;

					if (!existingIssue) {
						// New issue - prepare for batch insert
						const newIssue: CreateIssueData = {
							repoId,
							githubIssueNumber: githubIssue.number,
							title: githubIssue.title,
							body: githubIssue.body || null,
							state: githubIssue.state,
							commentCount: githubIssue.comments,
							assigneeStatus,
							githubUrl,
							metadataHash,
							createdAt: new Date(githubIssue.created_at),
							updatedAt: new Date(githubIssue.updated_at),
						};

						issuesToCreate.push(newIssue);
						this.stats.issues.new++;
					} else {
						// Issue exists - check if hash changed
						if (existingIssue.metadataHash !== metadataHash) {
							// Hash changed - prepare for update
							const updateData: UpdateIssueData = {
								title: githubIssue.title,
								body: githubIssue.body || null,
								state: githubIssue.state,
								commentCount: githubIssue.comments,
								assigneeStatus,
								metadataHash,
								updatedAt: new Date(githubIssue.updated_at),
							};

							issuesToUpdate.push({ id: existingIssue.id, data: updateData });
							issueIdsToQueue.push({ id: existingIssue.id, priority: 50 });
							this.stats.issues.updated++;
						} else {
							// Hash unchanged - skip
							this.stats.issues.unchanged++;
						}
					}

					this.stats.issues.processed++;
				} catch (error) {
					console.error(
						`Error preparing issue #${githubIssue.number} for ${owner}/${name}:`,
						error,
					);
					this.stats.issues.errors++;
				}
			}

			// Batch insert new issues (in chunks to avoid query size limits)
			if (issuesToCreate.length > 0) {
				console.log(`  Batch inserting ${issuesToCreate.length} new issues...`);

				// D1 limit: 100 parameters per query
				// Each issue has 15 parameters, so: 100 / 15 = 6.66
				// Use 6 to stay safely under the limit (6 × 15 = 90 parameters)
				const BATCH_SIZE = 6;
				const allInsertedIssues = [];

				for (let i = 0; i < issuesToCreate.length; i += BATCH_SIZE) {
					const chunk = issuesToCreate.slice(i, i + BATCH_SIZE);
					console.log(
						`    Inserting chunk ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(issuesToCreate.length / BATCH_SIZE)} (${chunk.length} issues)...`,
					);

					const insertedIssues = await batchCreateIssues(this.db as any, chunk);
					allInsertedIssues.push(...insertedIssues);
				}

				// Queue all new issues for processing
				console.log(`  Queueing ${allInsertedIssues.length} new issues...`);
				for (const insertedIssue of allInsertedIssues) {
					await this.queue.send({
						type: "issue",
						id: insertedIssue.id,
						priority: 100,
					});
					this.stats.issues.queued++;
				}

				console.log(
					`  ✓ Created and queued ${allInsertedIssues.length} new issues`,
				);
			}

			// Batch update existing issues (need to do one at a time, unfortunately)
			if (issuesToUpdate.length > 0) {
				console.log(`  Updating ${issuesToUpdate.length} changed issues...`);
				for (const { id, data } of issuesToUpdate) {
					await updateIssue(this.db as any, id, data);
				}
				console.log(`  ✓ Updated ${issuesToUpdate.length} issues`);
			}

			// Queue updated issues
			if (issueIdsToQueue.length > 0) {
				console.log(`  Queueing ${issueIdsToQueue.length} updated issues...`);
				for (const { id, priority } of issueIdsToQueue) {
					await this.queue.send({
						type: "issue",
						id,
						priority,
					});
					this.stats.issues.queued++;
				}
			}
		} catch (error) {
			// Check for subrequest limit
			if (this.isSubrequestLimitError(error)) {
				console.error("⛔ Hit subrequest limit during issue processing");
				throw error; // Propagate to trigger continuation
			}

			// Other errors - log and continue
			console.error(`Error processing issues for ${owner}/${name}:`, error);
			this.stats.issues.errors++;
		}
	}

	/**
	 * Check if error is due to subrequest limit or D1 connection failure
	 */
	private isSubrequestLimitError(error: unknown): boolean {
		if (error instanceof Error) {
			const msg = error.message;
			return (
				msg.includes("too many subrequests") ||
				msg.includes("Too many subrequests") ||
				msg.includes("subrequest limit") ||
				msg.includes("worker limit") ||
				// D1 errors that indicate subrequest limit
				msg.includes("Failed query") ||
				msg.includes("Network connection lost") ||
				msg.includes("network")
			);
		}
		return false;
	}

	getStats(): MetadataProcessorStats {
		return this.stats;
	}
}
