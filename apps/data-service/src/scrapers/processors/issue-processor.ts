/**
 * Issue processor - handles hash comparison for issues
 * Updates issues in D1 and enqueues them for AI processing when changed
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { GitHubApiClient, type GitHubIssue } from "../../utils/github-api";
import { hashIssueMetadata } from "../../utils/hash";
import {
	findIssueByRepoAndNumber,
	createIssue,
	updateIssue,
	type CreateIssueData,
	type UpdateIssueData,
} from "@repo/data-ops/queries/issues";
import { enqueueIssue } from "@repo/data-ops/queries/ai-queue";

export interface IssueProcessorStats {
	processed: number;
	new: number;
	updated: number;
	unchanged: number;
	errors: number;
}

export interface RepoInfo {
	id: number;
	owner: string;
	name: string;
	goodFirstIssueTag: string;
}

export class IssueProcessor {
	private db: DrizzleD1Database;
	private githubClient: GitHubApiClient;
	private stats: IssueProcessorStats = {
		processed: 0,
		new: 0,
		updated: 0,
		unchanged: 0,
		errors: 0,
	};

	constructor(db: DrizzleD1Database, githubClient: GitHubApiClient) {
		this.db = db;
		this.githubClient = githubClient;
	}

	async processRepos(repos: RepoInfo[], maxIssuesPerRepo?: number): Promise<IssueProcessorStats> {
		console.log(`Processing issues for ${repos.length} repos...`);
		if (maxIssuesPerRepo) {
			console.log(`⚠️  Limited to ${maxIssuesPerRepo} issues per repo`);
		}

		for (const repo of repos) {
			try {
				await this.processRepoIssues(repo, maxIssuesPerRepo);
			} catch (error) {
				console.error(
					`Error processing issues for ${repo.owner}/${repo.name}:`,
					error
				);
				this.stats.errors++;
			}
		}

		console.log("Issue processing complete:", this.stats);
		return this.stats;
	}

	private async processRepoIssues(repo: RepoInfo, maxIssues?: number): Promise<void> {
		console.log(
			`Fetching issues for ${repo.owner}/${repo.name} with label "${repo.goodFirstIssueTag}"`
		);

		// Fetch all open issues with the good-first-issue tag
		const issues = await this.githubClient.fetchAllIssues(
			repo.owner,
			repo.name,
			repo.goodFirstIssueTag,
			"open"
		);

		// Filter out pull requests (they have a pull_request field)
		let actualIssues = issues.filter((issue) => !issue.pull_request);

		console.log(`  Found ${actualIssues.length} open issues`);

		// Apply limit if specified
		if (maxIssues && actualIssues.length > maxIssues) {
			console.log(`  ⚠️  Processing only ${maxIssues} of ${actualIssues.length} issues`);
			actualIssues = actualIssues.slice(0, maxIssues);
		}

		for (const issue of actualIssues) {
			try {
				await this.processIssue(repo, issue);
			} catch (error) {
				console.error(
					`Error processing issue #${issue.number} for ${repo.owner}/${repo.name}:`,
					error
				);
				this.stats.errors++;
			}
		}
	}

	private async processIssue(
		repo: RepoInfo,
		githubIssue: GitHubIssue
	): Promise<void> {
		this.stats.processed++;

		// Check if issue exists
		const existingIssue = await findIssueByRepoAndNumber(
			this.db,
			repo.id,
			githubIssue.number
		);

		// Extract assignee logins
		const assigneeStatus =
			githubIssue.assignees.length > 0
				? githubIssue.assignees.map((a) => a.login)
				: null;

		// Compute metadata hash
		const metadataHash = await hashIssueMetadata(
			githubIssue.comments,
			githubIssue.state,
			assigneeStatus
		);

		const githubUrl = `https://github.com/${repo.owner}/${repo.name}/issues/${githubIssue.number}`;

		if (!existingIssue) {
			// New issue - insert
			await this.createNewIssue({
				repoId: repo.id,
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
			});

			this.stats.new++;
			console.log(`  ✓ Created new issue: #${githubIssue.number}`);
		} else {
			// Issue exists - check if hash changed
			if (existingIssue.metadataHash !== metadataHash) {
				// Hash changed - update
				await this.updateExistingIssue(existingIssue.id, {
					title: githubIssue.title,
					body: githubIssue.body || null,
					state: githubIssue.state,
					commentCount: githubIssue.comments,
					assigneeStatus,
					metadataHash,
					updatedAt: new Date(githubIssue.updated_at),
				});

				this.stats.updated++;
				console.log(`  ✓ Updated issue: #${githubIssue.number} (hash changed)`);
			} else {
				// Hash unchanged - skip
				this.stats.unchanged++;
				console.log(`  - Skipped issue: #${githubIssue.number} (no changes)`);
			}
		}
	}

	private async createNewIssue(data: CreateIssueData): Promise<void> {
		const issue = await createIssue(this.db, data);

		// Enqueue for AI processing
		await enqueueIssue(this.db, issue.id);
		console.log(`    → Enqueued issue ${issue.id} for AI processing`);
	}

	private async updateExistingIssue(
		id: number,
		data: UpdateIssueData
	): Promise<void> {
		await updateIssue(this.db, id, data);

		// Enqueue for AI processing (regenerate analysis with new data)
		await enqueueIssue(this.db, id);
		console.log(`    → Enqueued issue ${id} for AI processing (re-analyze)`);
	}

	getStats(): IssueProcessorStats {
		return this.stats;
	}
}

