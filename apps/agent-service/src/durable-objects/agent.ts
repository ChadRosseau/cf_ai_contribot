/**
 * Contribot Agent - Cloudflare Agents SDK Implementation with AI SDK
 * Handles real-time AI chat interactions with tool calling and streaming responses
 */

import { AIChatAgent } from "agents/ai-chat-agent";
import type { Env } from "cloudflare:workers";
import {
	streamText,
	type StreamTextOnFinishCallback,
	createUIMessageStream,
	convertToModelMessages,
	createUIMessageStreamResponse,
	type ToolSet,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { GitHubApiClient } from "../api/github-client";
import { initDatabase } from "@repo/data-ops/database/setup";
import {
	getUserPreferences,
	getUserGitHubTokens,
} from "@repo/data-ops/queries/users";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";

interface DashboardState {
	currentTab:
		| "overview"
		| "repos"
		| "list"
		| "issue"
		| "favourites"
		| "settings";
	activeIssueId?: number;
	activeRepoId?: number;
	lastAction?: string;
	forkedRepoName?: string;
	branchName?: string;
	// Current issues and repos (from AI suggestions OR user queries)
	issues?: unknown[];
	repos?: unknown[];
	// Pagination
	issuesPage?: number;
	reposPage?: number;
	issuesTotalPages?: number;
	reposTotalPages?: number;
	// Filters (persisted across page reloads)
	// Always an object, use empty object {} for no filters
	issuesFilters?: {
		languages?: string[];
		difficulty?: number;
		repoFilter?: string;
	};
}

export interface AgentState {
	userId: string;
	dashboardState: DashboardState;
	createdAt: number;
	updatedAt: number;
}

/**
 * Contribot Agent - AI-powered GitHub contribution assistant
 */
export class ContribotAgent extends AIChatAgent<Env, AgentState> {
	public apiClient: GitHubApiClient | null = null;

	// Public getter for env to allow tools to access it
	get environment(): Env {
		return this.env;
	}

	defaultState: AgentState = {
		userId: "",
		dashboardState: {
			currentTab: "overview",
			issuesFilters: {}, // Initialize with empty filters
		},
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};

	async onStart() {
		console.log("[Agent] Contribot Agent started");
		console.log(`[Agent] User ID: ${this.state.userId || "not set"}`);

		// Initialize GitHub API client if we have a user
		if (this.state.userId) {
			try {
				await this.initializeGitHubClient();
			} catch (error) {
				console.error("[Agent] Failed to initialize GitHub client:", error);
			}
		}
	}

	/**
	 * Initialize GitHub API client with user's access token
	 */
	private async initializeGitHubClient(): Promise<void> {
		const db = initDatabase(this.env.DB);
		// biome-ignore lint/suspicious/noExplicitAny: DB type compatibility
		const tokens = await getUserGitHubTokens(db as any, this.state.userId);

		if (!tokens) {
			console.warn("[Agent] GitHub tokens not found for user");
			return;
		}

		this.apiClient = new GitHubApiClient(tokens.accessToken);
		console.log("[Agent] GitHub API client initialized");
	}

	/**
	 * Handle incoming WebSocket messages
	 * Intercept custom messages for state updates before passing to parent
	 */
	async onMessage(
		// biome-ignore lint/suspicious/noExplicitAny: WebSocket message type
		connection: any,
		message: string | ArrayBuffer,
	): Promise<void> {
		// Only process string messages
		if (typeof message !== "string") {
			return super.onMessage(connection, message);
		}

		try {
			const parsed = JSON.parse(message);

			// Handle dashboard state updates from frontend
			if (parsed.type === "dashboard_state_update" && parsed.updates) {
				console.log("[Agent] Received dashboard state update:", parsed.updates);

				// Update the persisted dashboard state
				this.updateDashboardState(parsed.updates);

				// Don't pass to chat handler - this is not a chat message
				return;
			}
		} catch {
			// Not JSON or parsing error - pass to parent
		}

		// Pass all other messages to the parent AIChatAgent handler
		return super.onMessage(connection, message);
	}

	/**
	 * Handles incoming chat messages and manages the response stream
	 * This is called by the Agents SDK when a chat message arrives
	 */
	async onChatMessage(
		onFinish: StreamTextOnFinishCallback<ToolSet>,
		_options?: { abortSignal?: AbortSignal },
	) {
		console.log("[Agent] onChatMessage called");
		console.log(`[Agent] Message count: ${this.messages.length}`);

		// Ensure GitHub client is initialized
		if (!this.apiClient && this.state.userId) {
			await this.initializeGitHubClient();
		}

		// Get user preferences for system prompt
		const db = initDatabase(this.env.DB);
		// biome-ignore lint/suspicious/noExplicitAny: DB type compatibility
		const preferences = await getUserPreferences(db as any, this.state.userId);

		// Initialize OpenAI client with API key from environment
		const openai = createOpenAI({
			apiKey: this.env.OPENAI_API_KEY,
		});

		// Use OpenAI model (gpt-4o-mini is cost-effective and fast)
		const model = openai("gpt-4o-mini");

		// Collect all tools
		const allTools = {
			...tools,
		};

		const stream = createUIMessageStream({
			// biome-ignore lint/suspicious/noExplicitAny: AI SDK writer type is complex
			execute: async ({ writer }: { writer: any }) => {
				console.log("[Agent] Creating message stream");

				// Clean up incomplete tool calls to prevent API errors
				const cleanedMessages = cleanupMessages(this.messages);

				// Process any pending tool calls from previous messages
				// This handles human-in-the-loop confirmations for tools
				const processedMessages = await processToolCalls({
					messages: cleanedMessages,
					dataStream: writer,
					tools: allTools,
					executions,
				});

				console.log("[Agent] Starting text stream");
				const result = streamText({
					system: this.buildSystemPrompt(preferences),
					messages: convertToModelMessages(processedMessages),
					model,
					tools: allTools,
					toolChoice: "auto", // Allow model to decide when to use tools
					// Type boundary: streamText expects specific tool types, but base class uses ToolSet
					onFinish: onFinish as unknown as StreamTextOnFinishCallback<
						typeof allTools
					>,
					temperature: 0.7,
					maxRetries: 3,
				});

				// Filter the UI message stream to hide tool execution details
				const uiStream = result.toUIMessageStream();

				for await (const chunk of uiStream) {
					// biome-ignore lint/suspicious/noExplicitAny: Stream chunk type is complex
					const chunkAny = chunk as any;

					// Filter out internal execution details per AI SDK docs:
					// - toolCalls: raw function call data
					// - toolResults: raw execution results
					// - steps: execution flow details
					// Only show user-facing content like text
					if (chunkAny.toolCalls || chunkAny.toolResults || chunkAny.steps) {
						console.log("[Agent] Filtering out internal execution details:", {
							hasToolCalls: !!chunkAny.toolCalls,
							hasToolResults: !!chunkAny.toolResults,
							hasSteps: !!chunkAny.steps,
						});
						// Skip this chunk - don't send raw tool/step data to frontend
						continue;
					}

					// Pass through text and other user-facing content
					writer.write(chunk);
				}
			},
		});

		return createUIMessageStreamResponse({ stream });
	}

	/**
	 * Build system prompt with user context and preferences
	 */
	private buildSystemPrompt(
		preferences: Awaited<ReturnType<typeof getUserPreferences>>,
	): string {
		const languages = preferences?.preferredLanguages?.join(", ") || "any";
		const difficulty = preferences?.difficultyPreference || 3;

		return `You are Contribot, an AI assistant that helps developers find and contribute to open source projects.

## Your Capabilities

You can help users with:
- 🔍 **Finding Issues**: Suggest beginner-friendly open source issues based on programming languages
- 📦 **Repository Discovery**: Recommend repositories with good first issues
- 🍴 **GitHub Actions**: Fork repositories, create branches, comment on issues, and open pull requests
- ⭐ **Favorites**: Manage favorited repositories and issues
- ⚙️ **Preferences**: Update language preferences and difficulty levels

## User Preferences

- **Preferred Languages**: ${languages}
- **Difficulty Level**: ${difficulty}/5

## Guidelines

1. **Be Conversational**: Use a friendly, helpful tone
2. **Be Specific**: When suggesting issues or repos, provide clear details
3. **Ask for Confirmation**: Always confirm before performing GitHub actions (fork, comment, PR)
4. **Provide Context**: Explain what each action does and why it's helpful
5. **Use Tools**: Use the available tools to perform actions - don't just describe them
6. **Format Output**: Use markdown for better readability (lists, headings, code blocks)
7. **CRITICAL - NO RAW DATA**: NEVER output raw JSON, tool results, or data structures. ALWAYS format tool results into conversational, user-friendly text. When a tool returns data, read the "message" field and present it conversationally with additional context.

## Tool Usage & Result Formatting

**CRITICAL RULE**: After EVERY tool execution, you MUST generate a conversational text response. NEVER end your response with just a tool call.

**Flow**: Tool Call → Tool Executes → You Generate Text Response

For suggestIssues/suggestRepos:
- The tool returns: { success: true, message: "Found X items...", items: [...] }
- You MUST respond with formatted text that:
  1. Confirms the action ("✅ Found 5 TypeScript issues!")
  2. Highlights 2-3 specific examples from the results
  3. Directs them to the dashboard tab
  4. Asks a follow-up question

Example: "✅ Found 5 beginner-friendly TypeScript issues! I've added them to your Issues tab. Here are a few highlights: **React type inference bug** (⭐⭐⭐ difficulty), **Documentation improvement** (⭐⭐), and **Test refactoring** (⭐⭐⭐). Want to dive into one of these?"

- Use \`suggestIssues\` when users want to find issues to work on
- Use \`suggestRepos\` when users want to discover repositories
- Use \`forkRepository\` when users want to fork a repo (requires confirmation)
- Use \`createBranch\` when users want to create a branch (requires confirmation)
- Use \`commentOnIssue\` when users want to comment (requires confirmation)
- Use \`createPullRequest\` when users want to open a PR (requires confirmation)
- Use \`toggleFavourite\` when users want to save/unsave items
- Use \`getFavourites\` when users ask about their favorites
- Use \`updatePreferences\` when users want to change their settings

Remember: Actions like forking, commenting, and creating PRs will ask the user for confirmation before executing.`;
	}

	/**
	 * Update dashboard state and persist
	 */
	public updateDashboardState(updates: Partial<DashboardState>): void {
		const newDashboardState = {
			...this.state.dashboardState,
			...updates,
		};

		// Special handling for issuesFilters: merge properties instead of replacing
		newDashboardState.issuesFilters = updates.issuesFilters;

		this.state.dashboardState = newDashboardState;
		this.state.updatedAt = Date.now();
		this.setState(this.state);
	}

	/**
	 * Broadcast state update to all connected clients via WebSocket
	 * Note: With AIChatAgent, state updates are handled through the message stream
	 */
	public broadcastStateUpdate(): void {
		// State updates are persisted and will be available on next message
		console.log("[Agent] Dashboard state updated:", this.state.dashboardState);
	}

	/**
	 * Fetch all user repositories from GitHub and analyze language usage
	 * Returns top 10 most-used languages across all repos
	 */
	public async getUserLanguages(): Promise<string[]> {
		if (!this.apiClient) {
			// Try to initialize if not yet done
			if (this.state.userId) {
				await this.initializeGitHubClient();
			}
			if (!this.apiClient) {
				throw new Error("GitHub API client not initialized");
			}
		}

		console.log("[Agent] Fetching all user repositories for language analysis");
		const repos = await this.apiClient.fetchAllUserRepositories();

		// Count language occurrences across all repos
		const languageCounts = new Map<string, number>();
		for (const repo of repos) {
			if (repo.language) {
				languageCounts.set(
					repo.language,
					(languageCounts.get(repo.language) || 0) + 1,
				);
			}
		}

		// Sort by count and get top 10
		const topLanguages = Array.from(languageCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([language]) => language);

		console.log("[Agent] Top languages:", topLanguages);
		return topLanguages;
	}

	/**
	 * Custom fetch handler for non-WebSocket requests
	 * Handles direct HTTP endpoints like /initialize and /languages
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Handle initialization request
		if (url.pathname === "/initialize" && request.method === "POST") {
			try {
				const data = (await request.json()) as { userId: string };
				const userId = data.userId;

				if (!this.state.userId) {
					this.state.userId = userId;
					this.state.createdAt = Date.now();
					this.state.updatedAt = Date.now();
					await this.setState(this.state);
					await this.initializeGitHubClient();
				}

				return Response.json({ success: true });
			} catch (error) {
				return Response.json(
					{ error: error instanceof Error ? error.message : String(error) },
					{ status: 500 },
				);
			}
		}

		// Handle get languages request
		if (url.pathname === "/languages" && request.method === "GET") {
			try {
				const languages = await this.getUserLanguages();
				return Response.json({ languages });
			} catch (error) {
				return Response.json(
					{ error: error instanceof Error ? error.message : String(error) },
					{ status: 500 },
				);
			}
		}

		// For all other requests, let the parent AIChatAgent handle it
		// This includes WebSocket upgrades
		return super.fetch(request);
	}
}
