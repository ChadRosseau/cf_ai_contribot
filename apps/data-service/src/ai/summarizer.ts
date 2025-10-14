/**
 * AI Summarizer - interfaces with Workers AI (Llama 3.3)
 */

import { generateRepoSummaryPrompt } from "./prompts/repo-summary";
import { generateIssueAnalysisPrompt } from "./prompts/issue-analysis";

export interface RepoSummaryResult {
	summary: string;
}

export interface IssueAnalysisResult {
	intro: string;
	difficulty: number;
	firstSteps: string;
}

export class AiSummarizer {
	private ai: Ai;
	private readonly MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
	private readonly TIMEOUT_MS = 30000;

	constructor(ai: Ai) {
		this.ai = ai;
	}

	async summarizeRepo(
		repoOwner: string,
		repoName: string,
		languages: string[],
	): Promise<RepoSummaryResult> {
		const prompt = generateRepoSummaryPrompt(repoName, repoOwner, languages);

		try {
			const response = await this.runAiModel(prompt, 500);
			return {
				summary: response.trim(),
			};
		} catch (error) {
			console.error(
				`Failed to generate repo summary for ${repoOwner}/${repoName}:`,
				error,
			);
			throw error;
		}
	}

	async analyzeIssue(
		repoOwner: string,
		repoName: string,
		issueTitle: string,
		issueBody: string | null,
	): Promise<IssueAnalysisResult> {
		const prompt = generateIssueAnalysisPrompt(
			repoName,
			repoOwner,
			issueTitle,
			issueBody,
		);

		try {
			const response = await this.runAiModel(prompt, 800);

			// Parse JSON response
			const parsed = this.parseIssueAnalysis(response);
			return parsed;
		} catch (error) {
			console.error(
				`Failed to analyze issue "${issueTitle}" for ${repoOwner}/${repoName}:`,
				error,
			);
			throw error;
		}
	}

	private async runAiModel(prompt: string, maxTokens: number): Promise<string> {
		const response = await this.ai.run(this.MODEL, {
			messages: [
				{
					role: "user",
					content: prompt,
				},
			],
			temperature: 0.7,
			max_tokens: maxTokens,
		});

		if (
			!response ||
			typeof response !== "object" ||
			!("response" in response)
		) {
			throw new Error("Invalid AI response format");
		}

		return (response as { response: string }).response;
	}

	private parseIssueAnalysis(response: string): IssueAnalysisResult {
		try {
			// Try to extract JSON from the response
			// Sometimes the model wraps it in markdown code blocks
			const jsonMatch = response.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error("No JSON found in response");
			}

			const parsed = JSON.parse(jsonMatch[0]);

			// Validate required fields
			if (!parsed.intro || !parsed.difficulty || !parsed.firstSteps) {
				throw new Error("Missing required fields in AI response");
			}

			// Ensure difficulty is between 1-5
			const difficulty = Math.max(1, Math.min(5, parseInt(parsed.difficulty)));

			return {
				intro: parsed.intro,
				difficulty,
				firstSteps: parsed.firstSteps,
			};
		} catch (error) {
			console.error("Failed to parse AI response:", response);

			// Fallback to defaults
			return {
				intro: "This issue requires investigation.",
				difficulty: 3,
				firstSteps:
					"Review the issue description and related code to understand what needs to be done.",
			};
		}
	}
}
