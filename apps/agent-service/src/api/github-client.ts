/**
 * GitHub REST API Client
 * Lightweight wrapper around the standard GitHub API
 * https://docs.github.com/en/rest
 */

export class GitHubApiClient {
	private readonly baseUrl = "https://api.github.com";
	private readonly accessToken: string;

	constructor(accessToken: string) {
		this.accessToken = accessToken;
	}

	private async request<T>(
		path: string,
		method: string = "GET",
		body?: Record<string, unknown>
	): Promise<T> {
		const response = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.accessToken}`,
				Accept: "application/vnd.github+json",
                "User-Agent": "Contribot-Agent/1.0",
			},
			body: body ? JSON.stringify(body) : undefined,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`GitHub API error: ${response.status} ${errorText}`);
		}

		return response.json() as Promise<T>;
	}

	async forkRepository(
		owner: string,
		repo: string
	): Promise<{ owner: string; name: string; url: string }> {
		const result = await this.request<any>(`/repos/${owner}/${repo}/forks`, "POST");
		return {
			owner: result.owner.login,
			name: result.name,
			url: result.html_url,
		};
	}

	async createBranch(
		owner: string,
		repo: string,
		branchName: string,
		fromBranch: string = "main"
	): Promise<{ name: string; sha: string }> {
		const ref = await this.request<any>(
			`/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`
		);

		const newRef = await this.request<any>(
			`/repos/${owner}/${repo}/git/refs`,
			"POST",
			{
				ref: `refs/heads/${branchName}`,
				sha: ref.object.sha,
			}
		);

		return {
			name: newRef.ref.replace("refs/heads/", ""),
			sha: newRef.object.sha,
		};
	}

	async createIssueComment(
		owner: string,
		repo: string,
		issueNumber: number,
		body: string
	): Promise<{ id: number; url: string }> {
		const result = await this.request<any>(
			`/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
			"POST",
			{ body }
		);
		return {
			id: result.id,
			url: result.html_url,
		};
	}

    async listUserRepositories(options?: {
        visibility?: "all" | "public" | "private";
        sort?: "created" | "updated" | "pushed" | "full_name";
        perPage?: number;
    }): Promise<
        Array<{ name: string; owner: string; fullName: string; language: string | null }>
    > {
        const params = new URLSearchParams({
            visibility: options?.visibility || "all",
            sort: options?.sort || "updated",
            per_page: String(options?.perPage || 30),
            affiliation: "owner",
        });
        const result = await this.request<any[]>(`/user/repos?${params.toString()}`);
        return result.map((repo) => ({
            name: repo.name,
            owner: repo.owner.login,
            fullName: repo.full_name,
            language: repo.language,
        }));
    }

	async getAuthenticatedUser(): Promise<{
		login: string;
		name: string | null;
		email: string | null;
		avatarUrl: string;
	}> {
		const result = await this.request<any>(`/user`);
		return {
			login: result.login,
			name: result.name,
			email: result.email,
			avatarUrl: result.avatar_url,
		};
	}

	async createPullRequest(
		owner: string,
		repo: string,
		title: string,
		head: string,
		base: string,
		body?: string
	): Promise<{ number: number; url: string; state: string }> {
		const result = await this.request<any>(
			`/repos/${owner}/${repo}/pulls`,
			"POST",
			{
				title,
				head,
				base,
				body,
			}
		);
		return {
			number: result.number,
			url: result.html_url,
			state: result.state,
		};
	}

	async listPullRequests(
		owner: string,
		repo: string,
		state: "open" | "closed" | "all" = "open"
	): Promise<Array<{ number: number; title: string; state: string; url: string }>> {
		const result = await this.request<any[]>(
			`/repos/${owner}/${repo}/pulls?state=${state}`
		);
		return result.map((pr) => ({
			number: pr.number,
			title: pr.title,
			state: pr.state,
			url: pr.html_url,
		}));
	}
}