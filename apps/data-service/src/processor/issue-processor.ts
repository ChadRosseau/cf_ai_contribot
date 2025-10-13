/**
 * Issue Processor for data-service
 * Fetches full issue details, generates AI analysis
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { getIssueById, updateIssue } from "@repo/data-ops/queries/issues";
import { getRepoById } from "@repo/data-ops/queries/repos";
import { storeIssueSummary } from "@repo/data-ops/queries/ai-summaries";
import { GitHubApiClient } from "../utils/github-api";
import { AiSummarizer } from "../ai/summarizer";

export interface IssueProcessingStats {
	issueId: number;
	detailsFetched: boolean;
	aiAnalysisGenerated: boolean;
}

export class IssueProcessor {
	private db: DrizzleD1Database;
	private githubClient: GitHubApiClient;
	private aiSummarizer: AiSummarizer;

	constructor(
		db: DrizzleD1Database,
		githubClient: GitHubApiClient,
		aiSummarizer: AiSummarizer
	) {
		this.db = db;
		this.githubClient = githubClient;
		this.aiSummarizer = aiSummarizer;
	}

	async processIssue(issueId: number): Promise<IssueProcessingStats> {
		const stats: IssueProcessingStats = {
			issueId,
			detailsFetched: false,
			aiAnalysisGenerated: false,
		};

		console.log(`\n=== Processing Issue #${issueId} ===`);

		// 1. Fetch issue from DB
		const issue = await getIssueById(this.db as any, issueId);
		if (!issue) {
			throw new Error(`[Issue ID ${issueId}] Issue not found in database`);
		}

		// 2. Fetch repo to get owner/name
		const repo = await getRepoById(this.db as any, issue.repoId);
		if (!repo) {
			throw new Error(`[Issue ID ${issueId}] Repo ID ${issue.repoId} not found`);
		}

		console.log(`Issue: ${repo.owner}/${repo.name}#${issue.githubIssueNumber} (Issue ID ${issueId})`);

		// 3. Fetch full issue details from GitHub (in case body was truncated in list)
		console.log("Fetching full issue details from GitHub...");
		try {
			const fullIssue = await this.githubClient.fetchIssue(
				repo.owner,
				repo.name,
				issue.githubIssueNumber
			);

			// Update issue body if different (might have been truncated)
			if (fullIssue.body && fullIssue.body !== issue.body) {
				await updateIssue(this.db as any, issueId, {
					body: fullIssue.body,
					title: fullIssue.title,
					state: fullIssue.state,
					commentCount: fullIssue.comments,
					assigneeStatus:
						fullIssue.assignees.length > 0
							? fullIssue.assignees.map((a) => a.login)
							: null,
					metadataHash: issue.metadataHash, // Keep same hash
					updatedAt: new Date(fullIssue.updated_at),
				});
				console.log("✓ Updated issue with full details");
			}

			stats.detailsFetched = true;
		} catch (error) {
			console.error(`❌ [Issue ID ${issueId}] Failed to fetch full issue details:`, error);
			throw error; // Will retry
		}

		// 4. Generate AI analysis
		console.log("Generating AI analysis...");
		try {
			// Fetch updated issue to get full body
			const updatedIssue = await getIssueById(this.db as any, issueId);
			if (!updatedIssue) throw new Error(`[Issue ID ${issueId}] Issue not found after update`);

			const analysis = await this.aiSummarizer.analyzeIssue(
				repo.owner,
				repo.name,
				updatedIssue.title,
				updatedIssue.body || "",
				repo.languagesOrdered || []
			);

			// Store AI analysis
			await storeIssueSummary(this.db as any, issueId, {
				issueIntro: analysis.intro,
				difficultyScore: analysis.difficulty,
				firstSteps: analysis.firstSteps,
			});

			stats.aiAnalysisGenerated = true;
			console.log(`✓ Generated AI analysis (difficulty: ${analysis.difficulty})`);
		} catch (error) {
			console.error(`⚠️ [Issue ID ${issueId}] Failed to generate AI analysis:`, error);
			// Don't throw - mark as failed instead
		}

		// 5. Mark issue as processed
		await updateIssue(this.db as any, issueId, {
			processingStatus: "completed",
		});
		console.log(`✓ Issue #${issueId} processing complete`);

		return stats;
	}
}
