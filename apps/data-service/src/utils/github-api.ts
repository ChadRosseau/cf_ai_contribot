/**
 * GitHub API client with rate limiting
 * Ensures we stay under 5000 requests/hour limit
 */

interface RateLimitState {
	requestsThisHour: number;
	hourStartTime: number;
	lastRequestTime: number;
}

export class GitHubApiClient {
	private token: string;
	private rateLimitState: RateLimitState;
	private readonly MAX_REQUESTS_PER_HOUR = 5000;
	private readonly MIN_DELAY_MS = 2000; // Minimum 2 seconds between requests (30 req/min max)

	constructor(token: string) {
		this.token = token;
		this.rateLimitState = {
			requestsThisHour: 0,
			hourStartTime: Date.now(),
			lastRequestTime: 0,
		};
	}

	/**
	 * Check and update rate limit state
	 * Returns milliseconds to wait before next request
	 */
	private checkRateLimit(): number {
		const now = Date.now();
		const hourElapsed = now - this.rateLimitState.hourStartTime;

		// Reset counter if hour has passed
		if (hourElapsed >= 3600000) {
			this.rateLimitState.requestsThisHour = 0;
			this.rateLimitState.hourStartTime = now;
		}

		// Check if we're approaching the limit
		if (this.rateLimitState.requestsThisHour >= this.MAX_REQUESTS_PER_HOUR - 100) {
			// Wait until next hour
			const timeUntilNextHour = 3600000 - hourElapsed;
			console.warn(
				`Rate limit approaching. Waiting ${timeUntilNextHour}ms until next hour`
			);
			return timeUntilNextHour;
		}

		// Calculate minimum delay since last request
		const timeSinceLastRequest = now - this.rateLimitState.lastRequestTime;
		if (timeSinceLastRequest < this.MIN_DELAY_MS) {
			return this.MIN_DELAY_MS - timeSinceLastRequest;
		}

		return 0;
	}

	/**
	 * Make a rate-limited request to GitHub API
	 */
	private async request<T>(
		endpoint: string,
		retries = 3
	): Promise<T> {
		// Check rate limit and wait if necessary
		const delayMs = this.checkRateLimit();
		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}

		// Update rate limit state
		this.rateLimitState.requestsThisHour++;
		this.rateLimitState.lastRequestTime = Date.now();

		// Debug logging (hide most of token)
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

			// Check rate limit headers from response
			const remaining = response.headers.get("X-RateLimit-Remaining");
			if (remaining && parseInt(remaining) < 100) {
				console.warn(`GitHub API rate limit low: ${remaining} remaining`);
			}

			// Handle rate limit exceeded
			if (response.status === 429) {
				const retryAfter = response.headers.get("Retry-After");
				const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
				console.warn(`Rate limit exceeded. Waiting ${waitTime}ms`);
				await new Promise((resolve) => setTimeout(resolve, waitTime));
				
				if (retries > 0) {
					return this.request<T>(endpoint, retries - 1);
				}
				throw new Error("Rate limit exceeded after retries");
			}

			// Handle other errors
			if (!response.ok) {
				// Log detailed error information
				const errorBody = await response.text();
				console.error(`GitHub API Error Response (${response.status}):`, errorBody);
				
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
				throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorBody}`);
			}

			return await response.json();
		} catch (error) {
			// Retry on network errors
			if (retries > 0 && error instanceof TypeError) {
				console.warn(`Network error, retrying... (${retries} attempts left)`);
				await new Promise((resolve) => setTimeout(resolve, 1000 * (4 - retries)));
				return this.request<T>(endpoint, retries - 1);
			}
			throw error;
		}
	}

	/**
	 * Fetch repository languages from GitHub
	 * Returns both raw object and ordered array
	 */
	async fetchRepoLanguages(
		owner: string,
		name: string
	): Promise<{
		raw: Record<string, number>;
		ordered: string[];
	}> {
		try {
			const languages = await this.request<Record<string, number>>(
				`/repos/${owner}/${name}/languages`
			);

			// Sort languages by bytes (descending) and extract names
			const ordered = Object.entries(languages)
				.sort(([, a], [, b]) => b - a)
				.map(([lang]) => lang);

			return {
				raw: languages,
				ordered,
			};
		} catch (error) {
			console.error(`Failed to fetch languages for ${owner}/${name}:`, error);
			// Return empty on error
			return {
				raw: {},
				ordered: [],
			};
		}
	}

	/**
	 * Fetch issues with a specific label from a repository
	 */
	async fetchIssues(
		owner: string,
		name: string,
		label: string,
		state: "open" | "closed" | "all" = "open",
		page = 1,
		perPage = 100
	): Promise<GitHubIssue[]> {
		try {
			const issues = await this.request<GitHubIssue[]>(
				`/repos/${owner}/${name}/issues?labels=${encodeURIComponent(
					label
				)}&state=${state}&page=${page}&per_page=${perPage}`
			);

			return issues;
		} catch (error) {
			console.error(`Failed to fetch issues for ${owner}/${name}:`, error);
			return [];
		}
	}

	/**
	 * Fetch all issues with pagination
	 */
	async fetchAllIssues(
		owner: string,
		name: string,
		label: string,
		state: "open" | "closed" | "all" = "open"
	): Promise<GitHubIssue[]> {
		const allIssues: GitHubIssue[] = [];
		let page = 1;
		let hasMore = true;

		while (hasMore) {
			const issues = await this.fetchIssues(owner, name, label, state, page, 100);
			
			if (issues.length === 0) {
				hasMore = false;
			} else {
				allIssues.push(...issues);
				page++;
				
				// Safety limit: max 100 pages (10,000 issues)
				if (page > 100) {
					console.warn(
						`Reached pagination limit for ${owner}/${name}. Some issues may be missing.`
					);
					hasMore = false;
				}
			}
		}

		return allIssues;
	}

	/**
	 * Get current rate limit stats
	 */
	getRateLimitStats() {
		return {
			made: this.rateLimitState.requestsThisHour,
			requestsThisHour: this.rateLimitState.requestsThisHour,
			remaining: this.MAX_REQUESTS_PER_HOUR - this.rateLimitState.requestsThisHour,
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
	pull_request?: unknown; // Issues with this field are actually PRs
}

