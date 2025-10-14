/**
 * Repository Processor for data-service
 * Fetches languages, generates AI summary, fetches/processes issues
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { getRepoById, updateRepo } from "@repo/data-ops/queries/repos";
import {
	findIssueByRepoAndNumber,
	batchCreateIssues,
	batchFindIssuesByNumbers,
	getOpenIssuesByRepoId,
	updateIssue,
	type CreateIssueData,
	type UpdateIssueData,
} from "@repo/data-ops/queries/issues";
import { storeRepoSummary } from "@repo/data-ops/queries/ai-summaries";
import { GitHubApiClient, type GitHubIssue } from "../utils/github-api";
import { AiSummarizer } from "../ai/summarizer";
import { hashIssueMetadata } from "../utils/hash";

export interface RepoProcessingStats {
	repoId: number;
	languagesFetched: boolean;
	aiSummaryGenerated: boolean;
	issuesProcessed: number;
	issuesNew: number;
	issuesUpdated: number;
	issuesUnchanged: number;
	issuesClosed: number;
	issuesQueued: number;
	issuesErrors: number;
}

export class RepoProcessor {
	private db: DrizzleD1Database;
	private githubClient: GitHubApiClient;
	private aiSummarizer: AiSummarizer;
	private queue: Queue<ProcessingQueueMessage>;

	constructor(
		db: DrizzleD1Database,
		githubClient: GitHubApiClient,
		aiSummarizer: AiSummarizer,
		queue: Queue<ProcessingQueueMessage>,
	) {
		this.db = db;
		this.githubClient = githubClient;
		this.aiSummarizer = aiSummarizer;
		this.queue = queue;
	}

	async processRepo(repoId: number): Promise<RepoProcessingStats> {
		const stats: RepoProcessingStats = {
			repoId,
			languagesFetched: false,
			aiSummaryGenerated: false,
			issuesProcessed: 0,
			issuesNew: 0,
			issuesUpdated: 0,
			issuesUnchanged: 0,
			issuesClosed: 0,
			issuesQueued: 0,
			issuesErrors: 0,
		};

		console.log(`\n=== Processing Repo #${repoId} ===`);

		// 1. Fetch repo from DB
		const repo = await getRepoById(this.db as any, repoId);
		if (!repo) {
			throw new Error(`Repo #${repoId} not found in database`);
		}

		console.log(`Repo: ${repo.owner}/${repo.name}`);

		// 2. Fetch languages from GitHub
		console.log("Fetching languages from GitHub...");
		try {
			const languages = await this.githubClient.fetchRepoLanguages(
				repo.owner,
				repo.name,
			);

			// Update repo with languages
			await updateRepo(this.db as any, repoId, {
				languagesOrdered: languages.ordered,
				languagesRaw: languages.raw,
			});

			stats.languagesFetched = true;
			console.log(`✓ Fetched languages: ${languages.ordered.join(", ")}`);
		} catch (error) {
			console.error(`❌ [Repo ID ${repoId}] Failed to fetch languages:`, error);
			throw error; // Will retry
		}

		// 3. Generate AI summary
		console.log("Generating AI summary...");
		try {
			const repoWithLanguages = await getRepoById(this.db as any, repoId);
			if (!repoWithLanguages)
				throw new Error(`Repo ID ${repoId} not found after language update`);

			const result = await this.aiSummarizer.summarizeRepo(
				repoWithLanguages.owner,
				repoWithLanguages.name,
				repoWithLanguages.languagesOrdered || [],
			);

			// Store AI summary
			await storeRepoSummary(this.db as any, repoId, result.summary);

			stats.aiSummaryGenerated = true;
			console.log(`✓ Generated AI summary`);
		} catch (error) {
			console.error(
				`⚠️ [Repo ID ${repoId}] Failed to generate AI summary:`,
				error,
			);
			// Don't throw - continue with issues
		}

		// 4. Fetch and process issues
		console.log(`Fetching issues for ${repo.owner}/${repo.name}...`);
		try {
			const githubIssues = await this.githubClient.fetchAllIssues(
				repo.owner,
				repo.name,
				repo.goodFirstIssueTag,
				"open",
			);

			// Filter out PRs
			const actualIssues = githubIssues.filter((issue) => !issue.pull_request);
			console.log(`Found ${actualIssues.length} open issues`);

			if (actualIssues.length > 0) {
				const issueStats = await this.processIssues(
					repo.id,
					repo.owner,
					repo.name,
					actualIssues,
				);
				stats.issuesProcessed = issueStats.processed;
				stats.issuesNew = issueStats.new;
				stats.issuesUpdated = issueStats.updated;
				stats.issuesUnchanged = issueStats.unchanged;
				stats.issuesQueued = issueStats.queued;
				stats.issuesErrors = issueStats.errors;
			}

			// 4b. Detect closed issues
			const closedCount = await this.detectClosedIssues(
				repo.id,
				repo.owner,
				repo.name,
				actualIssues,
			);
			stats.issuesClosed = closedCount;
		} catch (error) {
			console.error(
				`❌ [Repo ID ${repoId}] Failed to fetch/process issues:`,
				error,
			);
			throw error; // Will retry
		}

		// 5. Mark repo as processed
		await updateRepo(this.db as any, repoId, {
			processingStatus: "completed",
		});
		console.log(`✓ Repo #${repoId} processing complete`);

		return stats;
	}

	private async processIssues(
		repoId: number,
		owner: string,
		name: string,
		githubIssues: GitHubIssue[],
	): Promise<{
		processed: number;
		new: number;
		updated: number;
		unchanged: number;
		queued: number;
		errors: number;
	}> {
		const stats = {
			processed: 0,
			new: 0,
			updated: 0,
			unchanged: 0,
			queued: 0,
			errors: 0,
		};

		// Batch fetch existing issues
		const issueNumbers = githubIssues.map((i) => i.number);
		const existingIssuesMap = await batchFindIssuesByNumbers(
			this.db as any,
			repoId,
			issueNumbers,
		);

		const issuesToCreate: CreateIssueData[] = [];
		const issuesToUpdate: Array<{ id: number; data: UpdateIssueData }> = [];
		const issueIdsToQueue: number[] = [];

		// Process each issue
		for (const githubIssue of githubIssues) {
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
					// New issue
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
					stats.new++;
				} else {
					// Existing issue - check if changed
					if (existingIssue.metadataHash !== metadataHash) {
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
						issueIdsToQueue.push(existingIssue.id);
						stats.updated++;
					} else {
						stats.unchanged++;
					}
				}

				stats.processed++;
			} catch (error) {
				console.error(
					`❌ [Repo ID ${repoId}] Error processing issue #${githubIssue.number}:`,
					error,
				);
				stats.errors++;
			}
		}

		// Batch insert new issues (in chunks due to D1 parameter limits)
		if (issuesToCreate.length > 0) {
			console.log(`  Batch inserting ${issuesToCreate.length} new issues...`);

			// D1 limit: 100 parameters per query
			// Each issue: 15 parameters, so 100/15 = 6.66 → use 6 per batch
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
					type: "process_issue",
					issueId: insertedIssue.id,
				});
				stats.queued++;
			}

			console.log(
				`  ✓ Created and queued ${allInsertedIssues.length} new issues`,
			);
		}

		// Update existing issues
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
			for (const issueId of issueIdsToQueue) {
				await this.queue.send({
					type: "process_issue",
					issueId,
				});
				stats.queued++;
			}
		}

		return stats;
	}

	/**
	 * Detect issues that have been closed since last scrape
	 * Compares open issues in DB with current open issues from GitHub
	 */
	private async detectClosedIssues(
		repoId: number,
		owner: string,
		name: string,
		currentOpenIssues: GitHubIssue[],
	): Promise<number> {
		console.log("\nDetecting closed issues...");

		// Get all issues in DB that are marked as "open" for this repo
		const dbOpenIssues = await getOpenIssuesByRepoId(this.db as any, repoId);

		if (dbOpenIssues.length === 0) {
			console.log("  No open issues in DB to check");
			return 0;
		}

		console.log(`  DB has ${dbOpenIssues.length} open issues`);

		// Create a set of currently open issue numbers from GitHub
		const currentOpenNumbers = new Set(
			currentOpenIssues.map((issue) => issue.number),
		);

		// Find issues in DB that are NOT in the current open list
		const potentiallyClosed = dbOpenIssues.filter(
			(dbIssue) => !currentOpenNumbers.has(dbIssue.githubIssueNumber),
		);

		if (potentiallyClosed.length === 0) {
			console.log("  ✓ No closed issues detected");
			return 0;
		}

		console.log(
			`  Found ${potentiallyClosed.length} potentially closed issues, verifying...`,
		);

		// Batch fetch these issues from GitHub to confirm their status
		const issueNumbers = potentiallyClosed.map((i) => i.githubIssueNumber);
		const fetchedIssues = await this.githubClient.batchFetchIssues(
			owner,
			name,
			issueNumbers,
		);

		let closedCount = 0;

		// Update issues that are confirmed closed
		for (const dbIssue of potentiallyClosed) {
			const githubIssue = fetchedIssues.get(dbIssue.githubIssueNumber);

			if (githubIssue && githubIssue.state === "closed") {
				// Issue is confirmed closed, update DB
				const assigneeStatus =
					githubIssue.assignees.length > 0
						? githubIssue.assignees.map((a) => a.login)
						: null;

				const metadataHash = await hashIssueMetadata(
					githubIssue.comments,
					githubIssue.state,
					assigneeStatus,
				);

				await updateIssue(this.db as any, dbIssue.id, {
					title: githubIssue.title,
					body: githubIssue.body || null,
					state: "closed",
					commentCount: githubIssue.comments,
					assigneeStatus,
					metadataHash,
					updatedAt: new Date(githubIssue.updated_at),
				});

				closedCount++;
				console.log(
					`    ✓ Issue #${dbIssue.githubIssueNumber} marked as closed`,
				);
			} else if (!githubIssue) {
				// Issue not found - might be deleted or access denied
				console.log(
					`    ⚠️ Issue #${dbIssue.githubIssueNumber} not found (deleted or access denied)`,
				);
			}
		}

		console.log(`  ✓ Marked ${closedCount} issues as closed`);
		return closedCount;
	}
}
