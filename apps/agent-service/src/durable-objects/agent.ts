/**
 * Contribot Agent - Durable Object implementing Cloudflare Agents SDK
 * Maintains per-user conversation state and orchestrates GitHub actions
 */

import { DurableObject } from "cloudflare:workers";
import { GitHubApiClient } from "../api/github-client";
import { initDatabase } from "@repo/data-ops/database/setup";
import {
	getUserPreferences,
	getUserGitHubTokens,
} from "@repo/data-ops/queries/users";

interface AgentState {
	userId: string;
	conversationHistory: ConversationMessage[];
	currentContext?: {
		issueId?: number;
		repoId?: number;
		lastAction?: string;
		forkedRepoName?: string;
		branchName?: string;
	};
	createdAt: number;
	updatedAt: number;
}

interface ConversationMessage {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
	metadata?: Record<string, unknown>;
}

export class ContribotAgent extends DurableObject {
	private state: AgentState | null = null;
	private apiClient: GitHubApiClient | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async initialize(userId: string): Promise<void> {
		const stored = await this.ctx.storage.get<AgentState>("state");

		if (stored) {
			this.state = stored;
		} else {
			this.state = {
				userId,
				conversationHistory: [],
				currentContext: {},
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};
			await this.saveState();
		}

		await this.initializeApiClient();
	}

	private async initializeApiClient(): Promise<void> {
		if (!this.state) {
			throw new Error("Agent not initialized");
		}

		const db = initDatabase(this.env.DB);
		const tokens = await getUserGitHubTokens(db as any, this.state.userId);

		if (!tokens) {
			throw new Error("GitHub tokens not found for user");
		}

		console.log("Tokens:", tokens);

		this.apiClient = new GitHubApiClient(tokens.accessToken);
	}

	private async saveState(): Promise<void> {
		if (!this.state) return;

		this.state.updatedAt = Date.now();
		await this.ctx.storage.put("state", this.state);
	}

	async chat(userMessage: string): Promise<{
		response: string;
		suggestedActions?: Array<{ action: string; label: string }>;
	}> {
		if (!this.state) {
			throw new Error("Agent not initialized");
		}

		this.state.conversationHistory.push({
			role: "user",
			content: userMessage,
			timestamp: Date.now(),
		});

		const systemPrompt = await this.buildSystemPrompt();
		const userContext = await this.buildUserContext();

		const aiResponse = await this.env.AI.run(
			"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			{
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "system", content: userContext },
					...this.state.conversationHistory.slice(-10).map((msg) => ({
						role: msg.role,
						content: msg.content,
					})),
				],
				temperature: 0.7,
				max_tokens: 800,
			},
		);

		const response = (aiResponse as { response: string }).response;

		this.state.conversationHistory.push({
			role: "assistant",
			content: response,
			timestamp: Date.now(),
		});

		await this.saveState();

		const suggestedActions = this.extractSuggestedActions(response);

		return {
			response,
			suggestedActions,
		};
	}

	async forkRepository(
		owner: string,
		repo: string,
	): Promise<{
		success: boolean;
		forkedRepo: { owner: string; name: string; url: string };
	}> {
		if (!this.apiClient) {
			throw new Error("MCP client not initialized");
		}

		const forkedRepo = await this.apiClient.forkRepository(owner, repo);

		if (this.state) {
			this.state.currentContext = {
				...this.state.currentContext,
				lastAction: "fork",
				forkedRepoName: forkedRepo.name,
			};
			await this.saveState();
		}

		return {
			success: true,
			forkedRepo,
		};
	}

	async createBranch(
		owner: string,
		repo: string,
		branchName: string,
		fromBranch?: string,
	): Promise<{
		success: boolean;
		branch: { name: string; sha: string };
	}> {
		if (!this.apiClient) {
			throw new Error("MCP client not initialized");
		}

		const branch = await this.apiClient.createBranch(
			owner,
			repo,
			branchName,
			fromBranch,
		);

		if (this.state) {
			this.state.currentContext = {
				...this.state.currentContext,
				lastAction: "create_branch",
				branchName: branch.name,
			};
			await this.saveState();
		}

		return {
			success: true,
			branch,
		};
	}

	async commentOnIssue(
		owner: string,
		repo: string,
		issueNumber: number,
		comment: string,
	): Promise<{
		success: boolean;
		comment: { id: number; url: string };
	}> {
		if (!this.apiClient) {
			throw new Error("MCP client not initialized");
		}

		const result = await this.apiClient.createIssueComment(
			owner,
			repo,
			issueNumber,
			comment,
		);

		if (this.state) {
			this.state.currentContext = {
				...this.state.currentContext,
				lastAction: "comment",
			};
			await this.saveState();
		}

		return {
			success: true,
			comment: result,
		};
	}

	async createPullRequest(
		owner: string,
		repo: string,
		title: string,
		head: string,
		base: string,
		body?: string,
	): Promise<{
		success: boolean;
		pullRequest: { number: number; url: string };
	}> {
		if (!this.apiClient) {
			throw new Error("MCP client not initialized");
		}

		const pr = await this.apiClient.createPullRequest(
			owner,
			repo,
			title,
			head,
			base,
			body,
		);

		if (this.state) {
			this.state.currentContext = {
				...this.state.currentContext,
				lastAction: "create_pr",
			};
			await this.saveState();
		}

		return {
			success: true,
			pullRequest: pr,
		};
	}

	async getUserRepositories(): Promise<
		Array<{
			name: string;
			owner: string;
			language: string | null;
		}>
	> {
		if (!this.apiClient) {
			throw new Error("MCP client not initialized");
		}

		return await this.apiClient.listUserRepositories({ perPage: 50 });
	}

	async getState(): Promise<AgentState | null> {
		return this.state;
	}

	async clearHistory(): Promise<void> {
		if (this.state) {
			this.state.conversationHistory = [];
			await this.saveState();
		}
	}

	private async buildSystemPrompt(): Promise<string> {
		return `You are Contribot, an AI assistant helping new developers make their first open-source contributions.

Your role:
- Guide users through forking repositories, creating branches, and making pull requests
- Explain GitHub workflows in beginner-friendly terms
- Suggest appropriate beginner-friendly issues based on user preferences
- Provide encouragement and clear next steps
- Keep responses concise and actionable

When a user needs to take a GitHub action (fork, branch, comment, PR), clearly state what action is needed and offer to help execute it.`;
	}

	private async buildUserContext(): Promise<string> {
		if (!this.state) return "";

		const db = initDatabase(this.env.DB);

		const preferences = await getUserPreferences(db as any, this.state.userId);

		let context = "User preferences:\n";
		if (preferences && preferences.preferredLanguages.length > 0) {
			context += `- Preferred languages: ${preferences.preferredLanguages.join(", ")}\n`;
		}
		context += `- Difficulty preference: ${preferences?.difficultyPreference || 3}/5\n`;

		if (this.state.currentContext?.issueId) {
			context += `\nCurrent context: User is viewing issue #${this.state.currentContext.issueId}\n`;
		}

		if (this.state.currentContext?.lastAction) {
			context += `Last action taken: ${this.state.currentContext.lastAction}\n`;
		}

		return context;
	}

	private extractSuggestedActions(
		response: string,
	): Array<{ action: string; label: string }> {
		const actions: Array<{ action: string; label: string }> = [];

		if (response.toLowerCase().includes("fork")) {
			actions.push({ action: "fork", label: "Fork Repository" });
		}
		if (response.toLowerCase().includes("branch")) {
			actions.push({ action: "branch", label: "Create Branch" });
		}
		if (response.toLowerCase().includes("comment")) {
			actions.push({ action: "comment", label: "Add Comment" });
		}
		if (
			response.toLowerCase().includes("pull request") ||
			response.toLowerCase().includes("pr")
		) {
			actions.push({ action: "pr", label: "Create Pull Request" });
		}

		return actions;
	}

	private async getUserLanguages(): Promise<string[]> {
		if (!this.apiClient) {
			throw new Error("MCP client not initialized");
		}

		const repos = await this.apiClient.fetchAllUserRepositories();

		const languageCounts = new Map<string, number>();
		for (const repo of repos) {
			if (repo.language) {
				languageCounts.set(
					repo.language,
					(languageCounts.get(repo.language) || 0) + 1,
				);
			}
		}

		// Compute top 10
		const topLanguages = Array.from(languageCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([language, count]) => ({ language, count }));

		return topLanguages.map((language) => language.language);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		console.log("Path:", path);

		if (request.method === "POST" && path === "/initialize") {
			console.log("Initializing agent");

			const data = await request.json<{ userId: string }>();
			console.log(data);
			const userId = data.userId;
			console.log("User ID:", userId);
			await this.initialize(userId);
			return Response.json({ success: true });
		}

		if (request.method === "POST" && path === "/chat") {
			const { message } = await request.json<{ message: string }>();
			const result = await this.chat(message);
			return Response.json(result);
		}

		if (request.method === "POST" && path === "/fork") {
			const { owner, repo } = await request.json<{
				owner: string;
				repo: string;
			}>();
			const result = await this.forkRepository(owner, repo);
			return Response.json(result);
		}

		if (request.method === "POST" && path === "/branch") {
			const { owner, repo, branchName, fromBranch } = await request.json<{
				owner: string;
				repo: string;
				branchName: string;
				fromBranch?: string;
			}>();
			const result = await this.createBranch(
				owner,
				repo,
				branchName,
				fromBranch,
			);
			return Response.json(result);
		}

		if (request.method === "POST" && path === "/comment") {
			const { owner, repo, issueNumber, comment } = await request.json<{
				owner: string;
				repo: string;
				issueNumber: number;
				comment: string;
			}>();
			const result = await this.commentOnIssue(
				owner,
				repo,
				issueNumber,
				comment,
			);
			return Response.json(result);
		}

		if (request.method === "POST" && path === "/pr") {
			const { owner, repo, title, head, base, body } = await request.json<{
				owner: string;
				repo: string;
				title: string;
				head: string;
				base: string;
				body?: string;
			}>();
			const result = await this.createPullRequest(
				owner,
				repo,
				title,
				head,
				base,
				body,
			);
			return Response.json(result);
		}

		if (request.method === "GET" && path === "/languages") {
			const languages = await this.getUserLanguages();
			return Response.json({ languages });
		}

		if (request.method === "GET" && path === "/repos") {
			const repos = await this.getUserRepositories();
			console.log("Repos:", repos);
			return Response.json({ repos });
		}

		if (request.method === "GET" && path === "/state") {
			const state = await this.getState();
			return Response.json({ state });
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	}
}
