/**
 * GitHub API client for scraper-service
 * Fetches repo metadata and issue lists (not full details)
 */

interface RateLimitState {
	requestsThisHour: number;
	hourStartTime: number;
	lastRequestTime: number;
}

export interface GitHubRepoMetadata {
	id: number;
	name: string;
	full_name: string;
	owner: {
		login: string;
	};
	open_issues_count: number;
	stargazers_count: number;
	forks_count: number;
	created_at: string;
	updated_at: string;
	pushed_at: string;
}

export interface GitHubIssueLabelCount {
	openCount: number;
}

interface GraphQLResponse {
	data?: {
		repository?: {
			issues: {
				totalCount: number;
			};
		};
	};
	errors?: Array<{ message: string }>;
}

export class GitHubApiClient {
	private token: string;
	private rateLimitState: RateLimitState;
	private readonly MAX_REQUESTS_PER_HOUR = 5000;
	private readonly MIN_DELAY_MS = 2000; // 2 seconds between requests (30 req/min)

	constructor(token: string) {
		this.token = token;
		this.rateLimitState = {
			requestsThisHour: 0,
			hourStartTime: Date.now(),
			lastRequestTime: 0,
		};
	}

	private checkRateLimit(): number {
		const now = Date.now();
		const hourElapsed = now - this.rateLimitState.hourStartTime;

		if (hourElapsed >= 3600000) {
			this.rateLimitState.requestsThisHour = 0;
			this.rateLimitState.hourStartTime = now;
		}

		if (
			this.rateLimitState.requestsThisHour >=
			this.MAX_REQUESTS_PER_HOUR - 100
		) {
			const timeUntilNextHour = 3600000 - hourElapsed;
			console.warn(
				`Rate limit approaching. Waiting ${timeUntilNextHour}ms until next hour`,
			);
			return timeUntilNextHour;
		}

		const timeSinceLastRequest = now - this.rateLimitState.lastRequestTime;
		if (timeSinceLastRequest < this.MIN_DELAY_MS) {
			return this.MIN_DELAY_MS - timeSinceLastRequest;
		}

		return 0;
	}

	private async request<T>(endpoint: string, retries = 3): Promise<T> {
		const delayMs = this.checkRateLimit();
		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}

		this.rateLimitState.requestsThisHour++;
		this.rateLimitState.lastRequestTime = Date.now();

		console.log(`GitHub API Request: GET https://api.github.com${endpoint}`);

		try {
			const response = await fetch(`https://api.github.com${endpoint}`, {
				headers: {
					Authorization: `token ${this.token}`,
					Accept: "application/vnd.github+json",
					"User-Agent": "Contribot-Scraper/1.0",
					"X-GitHub-Api-Version": "2022-11-28",
				},
			});

			if (response.headers.has("x-ratelimit-remaining")) {
				const remaining = parseInt(
					response.headers.get("x-ratelimit-remaining") || "0",
				);
				console.log(`GitHub rate limit remaining: ${remaining}`);
			}

			if (!response.ok) {
				const errorBody = await response.text();
				console.error(
					`GitHub API Error Response (${response.status}):`,
					errorBody,
				);

				if (response.status === 404) {
					throw new Error(`Not found: ${endpoint}`);
				}
				if (response.status === 403) {
					console.error("403 Forbidden - Possible causes:");
					console.error("  1. Invalid or expired token");
					console.error("  2. Token lacks required permissions");
					console.error("  3. Rate limit exceeded (different from 429)");
					throw new Error(`Forbidden: Check token validity`);
				}
				throw new Error(
					`GitHub API error: ${response.status} ${response.statusText} - ${errorBody}`,
				);
			}

			return await response.json();
		} catch (error) {
			if (retries > 0 && error instanceof TypeError) {
				console.warn(`Network error, retrying... (${retries} attempts left)`);
				await new Promise((resolve) =>
					setTimeout(resolve, 1000 * (4 - retries)),
				);
				return this.request<T>(endpoint, retries - 1);
			}
			throw error;
		}
	}

	/**
	 * Fetch repository metadata
	 */
	async fetchRepoMetadata(
		owner: string,
		name: string,
	): Promise<GitHubRepoMetadata> {
		return this.request<GitHubRepoMetadata>(`/repos/${owner}/${name}`);
	}

	/**
	 * Fetch open issue count for a specific label using GraphQL
	 */
	async fetchIssueLabelCount(
		owner: string,
		name: string,
		label: string,
	): Promise<GitHubIssueLabelCount> {
		const query = {
			query: `query {
				repository(owner: "${owner}", name: "${name}") {
					issues(labels: ["${label}"], states: OPEN) {
						totalCount
					}
				}
			}`,
		};

		// Wait for rate limit
		const delay = this.checkRateLimit();
		if (delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, delay));
		}

		this.rateLimitState.requestsThisHour++;
		this.rateLimitState.lastRequestTime = Date.now();

		console.log(
			`GitHub GraphQL Request: repository(owner: "${owner}", name: "${name}") label: "${label}"`,
		);

		try {
			const response = await fetch("https://api.github.com/graphql", {
				method: "POST",
				headers: {
					Authorization: `bearer ${this.token}`,
					"Content-Type": "application/json",
					"User-Agent": "Contribot-Scraper/2.0",
				},
				body: JSON.stringify(query),
			});

			if (!response.ok) {
				const errorBody = await response.text();
				console.error(`GitHub GraphQL Error (${response.status}):`, errorBody);
				throw new Error(
					`GitHub GraphQL error: ${response.status} ${response.statusText}`,
				);
			}

			const result = (await response.json()) as GraphQLResponse;

			if (result.errors) {
				console.error("GraphQL errors:", result.errors);
				throw new Error(
					`GraphQL query failed: ${JSON.stringify(result.errors)}`,
				);
			}

			if (!result.data?.repository) {
				throw new Error(
					`Repository not found or inaccessible: ${owner}/${name}`,
				);
			}

			return {
				openCount: result.data.repository.issues.totalCount,
			};
		} catch (error) {
			console.error(`Failed to fetch issue count for ${owner}/${name}:`, error);
			throw error;
		}
	}

	/**
	 * Fetch issues metadata (not full bodies)
	 */
	async fetchIssues(
		owner: string,
		name: string,
		label: string,
		state: "open" | "closed" | "all" = "open",
		page = 1,
		perPage = 100,
	): Promise<GitHubIssue[]> {
		try {
			const issues = await this.request<GitHubIssue[]>(
				`/repos/${owner}/${name}/issues?labels=${encodeURIComponent(
					label,
				)}&state=${state}&page=${page}&per_page=${perPage}`,
			);

			return issues;
		} catch (error) {
			console.error(`Failed to fetch issues for ${owner}/${name}:`, error);

			// Check for subrequest limit
			if (
				error instanceof Error &&
				error.message.includes("too many subrequests")
			) {
				throw error; // Propagate to trigger continuation
			}

			return [];
		}
	}

	/**
	 * Fetch all issues metadata with pagination (up to 10,000 issues)
	 */
	async fetchAllIssues(
		owner: string,
		name: string,
		label: string,
		state: "open" | "closed" | "all" = "open",
	): Promise<GitHubIssue[]> {
		const allIssues: GitHubIssue[] = [];
		let page = 1;
		let hasMore = true;

		while (hasMore) {
			const issues = await this.fetchIssues(
				owner,
				name,
				label,
				state,
				page,
				100,
			);

			if (issues.length === 0) {
				hasMore = false;
			} else {
				allIssues.push(...issues);
				page++;

				// Safety limit: max 100 pages (10,000 issues)
				if (page > 100) {
					console.warn(
						`Reached pagination limit for ${owner}/${name}. Some issues may be missing.`,
					);
					hasMore = false;
				}
			}
		}

		return allIssues;
	}

	getRateLimitStats() {
		return {
			made: this.rateLimitState.requestsThisHour,
			requestsThisHour: this.rateLimitState.requestsThisHour,
			remaining:
				this.MAX_REQUESTS_PER_HOUR - this.rateLimitState.requestsThisHour,
			maxPerHour: this.MAX_REQUESTS_PER_HOUR,
		};
	}
}

// GitHub API types
export interface GitHubIssue {
	number: number;
	title: string;
	body: string | null;
	state: string;
	comments: number;
	assignees: Array<{ login: string }>;
	created_at: string;
	updated_at: string;
	html_url: string;
	pull_request?: unknown;
}
