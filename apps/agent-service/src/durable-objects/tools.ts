/**
 * Tool definitions for the Contribot AI agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { getCurrentAgent } from "agents";
import type { ContribotAgent } from "./agent";
import { initDatabase } from "@repo/data-ops/database/setup";
import {
	getPaginatedRecommendedIssues,
	getIssueDetailsById,
} from "@repo/data-ops/queries/issues";
import { getPaginatedRepos } from "@repo/data-ops/queries/repos";
import {
	toggleFavourite as toggleFavouriteInDb,
	getFavouritedRepos,
	getFavouritedIssues,
} from "@repo/data-ops/queries/favourites";
import {
	getUserPreferences,
	updateUserPreferences,
} from "@repo/data-ops/queries/users";

/**
 * Suggest beginner-friendly issues based on languages and filters
 * Executes automatically
 */
const suggestIssues = tool({
	description:
		"Find and suggest beginner-friendly open source issues based on programming languages, difficulty level, and optional repository filter. Supports pagination.",
	inputSchema: z.object({
		languages: z
			.array(z.string())
			.describe(
				"Programming languages to filter by (e.g., ['TypeScript', 'Python']). IMPORTANT: Only provide if user specifies languages. To search ALL languages, omit this parameter entirely.",
			)
			.optional(),
		difficulty: z
			.number()
			.min(1)
			.max(5)
			.describe(
				"Exact difficulty level from 1 (easiest) to 5 (hardest). IMPORTANT: Only provide if user specifies a difficulty. Omit to use user's preference range.",
			)
			.optional(),
		repoFilter: z
			.string()
			.describe(
				"Repository filter in 'owner/repo' format. Only provide if user specifies a specific repository.",
			)
			.optional(),
		page: z
			.number()
			.min(1)
			.default(1)
			.describe("Page number for pagination (defaults to 1)"),
		limit: z.number().default(5).describe("Number of issues to return"),
	}),
	execute: async ({ languages, difficulty, repoFilter, page, limit }) => {
		console.log("[Tool] suggestIssues:", {
			languages,
			difficulty,
			repoFilter,
			page,
			limit,
		});
		const { agent } = getCurrentAgent<ContribotAgent>();
		if (!agent) throw new Error("Agent context not available");

		const db = initDatabase(agent.environment.DB);
		const preferences = await getUserPreferences(
			// biome-ignore lint/suspicious/noExplicitAny: DB type compatibility
			db as any,
			agent.state.userId,
		);

		// Use provided filters or fall back to stored filters from last query
		// When AI doesn't specify a filter, check if we have previous filters from dashboard state
		// If not, use user preferences as final fallback
		// Special case: if AI explicitly provides undefined (didn't specify), use empty array for languages (= search all)
		const currentFilters = {
			languages:
				languages !== undefined
					? languages // AI specified languages (could be empty array or specific languages)
					: agent.state.dashboardState.issuesFilters?.languages !== undefined
						? agent.state.dashboardState.issuesFilters.languages // Use previous dashboard filter
						: [], // No filter = search all languages (empty array means no language filter)
			difficulty:
				difficulty !== undefined
					? difficulty
					: (agent.state.dashboardState.issuesFilters?.difficulty ??
						preferences?.difficultyPreference ??
						3),
			repoFilter:
				repoFilter !== undefined
					? repoFilter
					: agent.state.dashboardState.issuesFilters?.repoFilter,
		};

		// Use exact matching when AI explicitly sets any filter
		// This ensures user gets what they asked for, not a range
		const hasExplicitFilters =
			languages !== undefined ||
			difficulty !== undefined ||
			repoFilter !== undefined;

		const issues = await getPaginatedRecommendedIssues(
			// biome-ignore lint/suspicious/noExplicitAny: DB type compatibility
			db as any,
			currentFilters.languages,
			currentFilters.difficulty,
			page,
			limit,
			currentFilters.repoFilter,
			hasExplicitFilters, // Use exact difficulty matching when explicitly filtered
		);

		// Update dashboard state with navigation, data, filters, and pagination
		// Estimate total pages: if we got a full page, there might be more
		const estimatedTotalPages = issues.length === limit ? page + 1 : page;

		agent.updateDashboardState({
			currentTab: "list",
			issues: issues,
			repos: [], // Clear repos when showing issues
			issuesPage: page,
			issuesTotalPages: estimatedTotalPages,
			issuesFilters: currentFilters,
		});
		agent.broadcastStateUpdate();

		// Return a message that the AI should format nicely
		return {
			success: true,
			message: `Found ${issues.length} issues matching your criteria on page ${page}. They are now displayed in the Issues tab.`,
			issuesCount: issues.length,
			currentPage: page,
			issues: issues.map((issue) => ({
				id: issue.id, // Database ID for viewing issue details
				title: issue.title,
				url: issue.url,
				repo: `${issue.owner}/${issue.repoName}`,
				difficulty: issue.difficulty,
				languages: issue.languages?.slice(0, 3) || [],
				intro: issue.intro,
			})),
		};
	},
});

/**
 * Suggest repositories with beginner-friendly issues
 * Executes automatically
 */
const suggestRepos = tool({
	description:
		"Find and suggest repositories that have beginner-friendly open source issues. Supports pagination.",
	inputSchema: z.object({
		page: z
			.number()
			.min(1)
			.default(1)
			.describe("Page number for pagination (defaults to 1)"),
		limit: z.number().default(5).describe("Number of repos to return"),
	}),
	execute: async ({ page, limit }) => {
		console.log("[Tool] suggestRepos:", { page, limit });
		const { agent } = getCurrentAgent<ContribotAgent>();
		if (!agent) throw new Error("Agent context not available");

		const db = initDatabase(agent.environment.DB);
		// biome-ignore lint/suspicious/noExplicitAny: DB type compatibility
		const repos = await getPaginatedRepos(db as any, page, limit);

		// Update dashboard state with navigation, data, and pagination
		// Estimate total pages: if we got a full page, there might be more
		const estimatedTotalPages = repos.length === limit ? page + 1 : page;

		agent.updateDashboardState({
			currentTab: "repos",
			repos: repos,
			issues: [], // Clear issues when showing repos
			reposPage: page,
			reposTotalPages: estimatedTotalPages,
		});
		agent.broadcastStateUpdate();

		// Return a message that the AI should format nicely
		return {
			success: true,
			message: `Found ${repos.length} repositories with beginner-friendly issues on page ${page}. They are now displayed in the Repos tab.`,
			reposCount: repos.length,
			currentPage: page,
			repos: repos.map((repo) => ({
				name: `${repo.owner}/${repo.name}`,
				description: repo.description,
				openIssuesCount: repo.openIssuesCount,
				languages: repo.languages?.slice(0, 3) || [],
			})),
		};
	},
});

/**
 * Fork a repository - REQUIRES CONFIRMATION
 * User must approve before execution
 */
const forkRepository = tool({
	description:
		"Fork a GitHub repository to the user's account. This creates a copy they can modify.",
	inputSchema: z.object({
		owner: z.string().describe("Repository owner username"),
		repo: z.string().describe("Repository name"),
	}),
	// No execute function = requires human confirmation
});

/**
 * Create a branch in a forked repository - REQUIRES CONFIRMATION
 */
const createBranch = tool({
	description:
		"Create a new branch in a forked repository for working on an issue",
	inputSchema: z.object({
		branchName: z.string().describe("Name of the branch to create"),
		repo: z
			.string()
			.describe("Repository name in 'owner/repo' format")
			.optional(),
	}),
	// No execute function = requires human confirmation
});

/**
 * Comment on an issue - REQUIRES CONFIRMATION
 */
const commentOnIssue = tool({
	description: "Post a comment on a GitHub issue",
	inputSchema: z.object({
		owner: z.string().describe("Repository owner username"),
		repo: z.string().describe("Repository name"),
		issueNumber: z.number().describe("Issue number"),
		comment: z.string().describe("Comment text to post"),
	}),
	// No execute function = requires human confirmation
});

/**
 * Create a pull request - REQUIRES CONFIRMATION
 */
const createPullRequest = tool({
	description: "Create a pull request from a branch to the original repository",
	inputSchema: z.object({
		owner: z.string().describe("Repository owner username"),
		repo: z.string().describe("Repository name"),
		title: z.string().describe("Pull request title"),
		branchName: z.string().describe("Source branch name"),
		issueNumber: z
			.number()
			.describe("Issue number this PR addresses")
			.optional(),
	}),
	// No execute function = requires human confirmation
});

/**
 * Toggle favourite status for repo or issue
 * Executes automatically
 */
const toggleFavourite = tool({
	description: "Add or remove a repository or issue from favourites",
	inputSchema: z.object({
		entityType: z
			.enum(["repo", "issue"])
			.describe("Type of entity to favourite"),
		entityId: z.number().describe("ID of the entity"),
		favourite: z.boolean().describe("True to favourite, false to unfavourite"),
	}),
	execute: async ({ entityType, entityId, favourite }) => {
		console.log("[Tool] toggleFavourite:", {
			entityType,
			entityId,
			favourite,
		});
		const { agent } = getCurrentAgent<ContribotAgent>();
		if (!agent) throw new Error("Agent context not available");

		const db = initDatabase(agent.environment.DB);
		await toggleFavouriteInDb(
			// biome-ignore lint/suspicious/noExplicitAny: DB type compatibility
			db as any,
			agent.state.userId,
			entityType,
			entityId,
			favourite,
		);

		return {
			success: true,
			message: favourite
				? `${entityType} added to favourites`
				: `${entityType} removed from favourites`,
		};
	},
});

/**
 * Get user's favourited items
 * Executes automatically
 */
const getFavourites = tool({
	description: "Get the user's favourited repositories and issues",
	inputSchema: z.object({
		type: z
			.enum(["all", "repos", "issues"])
			.default("all")
			.describe("Type of favourites to retrieve"),
	}),
	execute: async ({ type }) => {
		console.log("[Tool] getFavourites:", { type });
		const { agent } = getCurrentAgent<ContribotAgent>();
		if (!agent) throw new Error("Agent context not available");

		const db = initDatabase(agent.environment.DB);

		if (type === "repos" || type === "all") {
			// biome-ignore lint/suspicious/noExplicitAny: DB type compatibility
			const repos = await getFavouritedRepos(db as any, agent.state.userId);
			if (type === "repos") return { repos };
		}

		if (type === "issues" || type === "all") {
			// biome-ignore lint/suspicious/noExplicitAny: DB type compatibility
			const issues = await getFavouritedIssues(db as any, agent.state.userId);
			if (type === "issues") return { issues };
		}

		// biome-ignore lint/suspicious/noExplicitAny: DB type compatibility
		const repos = await getFavouritedRepos(db as any, agent.state.userId);
		// biome-ignore lint/suspicious/noExplicitAny: DB type compatibility
		const issues = await getFavouritedIssues(db as any, agent.state.userId);

		return { repos, issues };
	},
});

/**
 * Update user preferences
 * Executes automatically
 */
const updatePreferences = tool({
	description:
		"Update user's language preferences and difficulty level for issue recommendations",
	inputSchema: z.object({
		preferredLanguages: z
			.array(z.string())
			.describe("List of preferred programming languages")
			.optional(),
		difficultyPreference: z
			.number()
			.min(1)
			.max(5)
			.describe("Difficulty level preference (1-5)")
			.optional(),
	}),
	execute: async ({ preferredLanguages, difficultyPreference }) => {
		console.log("[Tool] updatePreferences:", {
			preferredLanguages,
			difficultyPreference,
		});
		const { agent } = getCurrentAgent<ContribotAgent>();
		if (!agent) throw new Error("Agent context not available");

		const db = initDatabase(agent.environment.DB);
		const updates: {
			preferredLanguages?: string[];
			difficultyPreference?: number;
		} = {};

		if (preferredLanguages) updates.preferredLanguages = preferredLanguages;
		if (difficultyPreference)
			updates.difficultyPreference = difficultyPreference;

		await updateUserPreferences(
			// biome-ignore lint/suspicious/noExplicitAny: DB type compatibility
			db as any,
			agent.state.userId,
			updates,
		);

		return {
			success: true,
			updated: updates,
		};
	},
});

/**
 * Get the current list of issues displayed to the user
 * This is a resource tool that provides context to the AI
 * Executes automatically
 */
const getCurrentIssues = tool({
	description:
		"Get the list of issues currently displayed in the dashboard. Use this to understand which issues the user is referring to when they say 'the first issue', 'the second one', 'that Python issue', etc. This gives you context about what the user is looking at.",
	inputSchema: z.object({}),
	execute: async () => {
		console.log("[Tool] getCurrentIssues");
		const { agent } = getCurrentAgent<ContribotAgent>();
		if (!agent) throw new Error("Agent context not available");

		const currentIssues = agent.state.dashboardState.issues || [];

		if (currentIssues.length === 0) {
			return {
				success: false,
				message:
					"No issues are currently displayed. Use suggestIssues first to find issues.",
				issues: [],
			};
		}

		return {
			success: true,
			message: `Currently displaying ${currentIssues.length} issues.`,
			issuesCount: currentIssues.length,
			issues: currentIssues,
		};
	},
});

/**
 * View/open a specific issue to show details
 * Executes automatically
 */
const viewIssue = tool({
	description:
		"View, open, or show details of a specific issue from the search results. Use this when user wants to VIEW, OPEN, or SEE MORE about an issue (e.g., 'show me the first issue', 'open issue #2', 'view the third one', 'tell me more about that Python issue'). The issue must be from your recent suggestIssues results.",
	inputSchema: z.object({
		issueId: z
			.number()
			.describe(
				"The database ID of the issue (use the 'id' field from suggestIssues results, NOT the GitHub issue number)",
			),
	}),
	execute: async ({ issueId }) => {
		console.log("[Tool] viewIssue:", { issueId });
		const { agent } = getCurrentAgent<ContribotAgent>();
		if (!agent) throw new Error("Agent context not available");

		const db = initDatabase(agent.environment.DB);

		// Get the full issue details
		const issue = await getIssueDetailsById(
			// biome-ignore lint/suspicious/noExplicitAny: DB type compatibility
			db as any,
			issueId,
		);

		if (!issue) {
			return {
				success: false,
				message: `Issue with ID ${issueId} not found.`,
			};
		}

		// Prepare the full issue object for the dashboard
		const issueForDashboard = {
			id: issue.id,
			issueNumber: issue.issueNumber,
			title: issue.title,
			url: issue.url,
			owner: issue.owner,
			repoName: issue.repoName,
			languages: issue.languages || [],
			intro: issue.intro || "No summary available",
			difficulty: issue.difficulty || 3,
			firstSteps: issue.firstSteps || "Review the issue to get started",
		};

		// Update dashboard state to show the issue detail view
		agent.updateDashboardState({
			currentTab: "issue",
			activeIssueId: issueId,
			selectedIssue: issueForDashboard,
		});
		agent.broadcastStateUpdate();

		// Return comprehensive issue details for the AI to present
		return {
			success: true,
			message: `Opened issue details. The issue is now displayed in the Issue tab.`,
			issue: {
				title: issue.title,
				url: issue.url,
				repo: `${issue.owner}/${issue.repoName}`,
				difficulty: issue.difficulty || 3,
				languages: issue.languages?.slice(0, 5) || [],
				intro: issue.intro || "No summary available",
				firstSteps: issue.firstSteps || "Review the issue to get started",
				description:
					issue.body?.substring(0, 500) || "No description available",
				commentCount: issue.commentCount,
			},
		};
	},
});

/**
 * Export all available tools
 */
export const tools = {
	suggestIssues,
	suggestRepos,
	getCurrentIssues,
	viewIssue,
	forkRepository,
	createBranch,
	commentOnIssue,
	createPullRequest,
	toggleFavourite,
	getFavourites,
	updatePreferences,
} satisfies ToolSet;

/**
 * Implementation of confirmation-required tools
 * These correspond to tools above that don't have an execute function
 */
export const executions = {
	forkRepository: async ({ owner, repo }: { owner: string; repo: string }) => {
		console.log("[Tool Execution] forkRepository:", { owner, repo });
		const { agent } = getCurrentAgent<ContribotAgent>();
		if (!agent || !agent.apiClient) {
			throw new Error("Agent or API client not available");
		}

		await agent.apiClient.forkRepository(owner, repo);

		// Update dashboard state
		agent.updateDashboardState({
			forkedRepoName: `${owner}/${repo}`,
		});
		agent.broadcastStateUpdate();

		return {
			success: true,
			message: `Successfully forked ${owner}/${repo}`,
		};
	},

	createBranch: async ({
		branchName,
		repo,
	}: {
		branchName: string;
		repo?: string;
	}) => {
		console.log("[Tool Execution] createBranch:", { branchName, repo });
		const { agent } = getCurrentAgent<ContribotAgent>();
		if (!agent || !agent.apiClient) {
			throw new Error("Agent or API client not available");
		}

		const targetRepo = repo || agent.state.dashboardState.forkedRepoName;
		if (!targetRepo) {
			throw new Error("No repository specified and no forked repo found");
		}

		const [owner, repoName] = targetRepo.split("/");
		await agent.apiClient.createBranch(owner, repoName, branchName);

		// Update dashboard state
		agent.updateDashboardState({
			branchName,
		});
		agent.broadcastStateUpdate();

		return {
			success: true,
			message: `Successfully created branch ${branchName} in ${targetRepo}`,
		};
	},

	commentOnIssue: async ({
		owner,
		repo,
		issueNumber,
		comment,
	}: {
		owner: string;
		repo: string;
		issueNumber: number;
		comment: string;
	}) => {
		console.log("[Tool Execution] commentOnIssue:", {
			owner,
			repo,
			issueNumber,
			comment,
		});
		const { agent } = getCurrentAgent<ContribotAgent>();
		if (!agent || !agent.apiClient) {
			throw new Error("Agent or API client not available");
		}

		await agent.apiClient.createIssueComment(owner, repo, issueNumber, comment);

		return {
			success: true,
			message: `Successfully commented on issue #${issueNumber}`,
		};
	},

	createPullRequest: async ({
		owner,
		repo,
		title,
		branchName,
		issueNumber,
	}: {
		owner: string;
		repo: string;
		title: string;
		branchName: string;
		issueNumber?: number;
	}) => {
		console.log("[Tool Execution] createPullRequest:", {
			owner,
			repo,
			title,
			branchName,
			issueNumber,
		});
		const { agent } = getCurrentAgent<ContribotAgent>();
		if (!agent || !agent.apiClient) {
			throw new Error("Agent or API client not available");
		}

		let body = `This PR addresses the changes discussed.`;
		if (issueNumber) {
			body = `Fixes #${issueNumber}\n\n${body}`;
		}

		await agent.apiClient.createPullRequest(
			owner,
			repo,
			title,
			body,
			branchName,
			"main",
		);

		return {
			success: true,
			message: `Successfully created pull request: ${title}`,
		};
	},
};
