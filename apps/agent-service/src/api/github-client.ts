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
		body?: Record<string, unknown>,
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
		repo: string,
	): Promise<{ owner: string; name: string; url: string }> {
		const result = await this.request<any>(
			`/repos/${owner}/${repo}/forks`,
			"POST",
		);
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
		fromBranch: string = "main",
	): Promise<{ name: string; sha: string }> {
		const ref = await this.request<any>(
			`/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`,
		);

		const newRef = await this.request<any>(
			`/repos/${owner}/${repo}/git/refs`,
			"POST",
			{
				ref: `refs/heads/${branchName}`,
				sha: ref.object.sha,
			},
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
		body: string,
	): Promise<{ id: number; url: string }> {
		const result = await this.request<any>(
			`/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
			"POST",
			{ body },
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
		Array<{
			name: string;
			owner: string;
			fullName: string;
			language: string | null;
		}>
	> {
		const params = new URLSearchParams({
			visibility: options?.visibility || "all",
			sort: options?.sort || "updated",
			per_page: String(options?.perPage || 30),
			affiliation: "owner",
		});
		const result = await this.request<any[]>(
			`/user/repos?${params.toString()}`,
		);
		return result.map((repo) => ({
			name: repo.name,
			owner: repo.owner.login,
			fullName: repo.full_name,
			language: repo.language,
		}));
	}

	async fetchAllUserRepositories() {
		const perPage = 100;
		let allRepos: any[] = [];

		while (true) {
			const repos = await this.listUserRepositories({
				perPage,
				sort: "updated",
			});

			allRepos = allRepos.concat(repos);

			// Stop if fewer than perPage repos returned
			if (repos.length < perPage) break;
		}

		return allRepos;
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
		body?: string,
	): Promise<{ number: number; url: string; state: string }> {
		const result = await this.request<any>(
			`/repos/${owner}/${repo}/pulls`,
			"POST",
			{
				title,
				head,
				base,
				body,
			},
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
		state: "open" | "closed" | "all" = "open",
	): Promise<
		Array<{ number: number; title: string; state: string; url: string }>
	> {
		const result = await this.request<any[]>(
			`/repos/${owner}/${repo}/pulls?state=${state}`,
		);
		return result.map((pr) => ({
			number: pr.number,
			title: pr.title,
			state: pr.state,
			url: pr.html_url,
		}));
	}

	async getRepository(
		owner: string,
		repo: string,
	): Promise<{
		name: string;
		fullName: string;
		description: string | null;
		defaultBranch: string;
		language: string | null;
		fork: boolean;
		parent?: { owner: string; name: string };
	}> {
		const result = await this.request<any>(`/repos/${owner}/${repo}`);
		return {
			name: result.name,
			fullName: result.full_name,
			description: result.description,
			defaultBranch: result.default_branch,
			language: result.language,
			fork: result.fork,
			parent: result.parent
				? { owner: result.parent.owner.login, name: result.parent.name }
				: undefined,
		};
	}

	async getIssue(
		owner: string,
		repo: string,
		issueNumber: number,
	): Promise<{
		number: number;
		title: string;
		body: string | null;
		state: string;
		url: string;
		comments: number;
		labels: string[];
	}> {
		const result = await this.request<any>(
			`/repos/${owner}/${repo}/issues/${issueNumber}`,
		);
		return {
			number: result.number,
			title: result.title,
			body: result.body,
			state: result.state,
			url: result.html_url,
			comments: result.comments,
			labels: result.labels.map((l: any) => l.name),
		};
	}

	async checkIfForked(
		owner: string,
		repo: string,
	): Promise<{ forked: boolean; forkUrl?: string; forkName?: string }> {
		try {
			const user = await this.getAuthenticatedUser();
			const repos = await this.listUserRepositories({ perPage: 100 });

			const fork = repos.find(
				(r) =>
					r.name.toLowerCase() === repo.toLowerCase() && r.owner === user.login,
			);

			if (fork) {
				return {
					forked: true,
					forkUrl: `https://github.com/${user.login}/${fork.name}`,
					forkName: fork.name,
				};
			}

			return { forked: false };
		} catch (error) {
			console.error("Failed to check fork status:", error);
			return { forked: false };
		}
	}

	async checkBranchExists(
		owner: string,
		repo: string,
		branchName: string,
	): Promise<boolean> {
		try {
			await this.request<any>(
				`/repos/${owner}/${repo}/git/ref/heads/${branchName}`,
			);
			return true;
		} catch (error) {
			return false;
		}
	}

	async getDefaultBranch(owner: string, repo: string): Promise<string> {
		const repoData = await this.getRepository(owner, repo);
		return repoData.defaultBranch;
	}

	async listIssues(
		owner: string,
		repo: string,
		options?: {
			state?: "open" | "closed" | "all";
			labels?: string[];
			perPage?: number;
		},
	): Promise<
		Array<{
			number: number;
			title: string;
			state: string;
			url: string;
			labels: string[];
		}>
	> {
		const params = new URLSearchParams({
			state: options?.state || "open",
			per_page: String(options?.perPage || 30),
		});

		if (options?.labels && options.labels.length > 0) {
			params.append("labels", options.labels.join(","));
		}

		const result = await this.request<any[]>(
			`/repos/${owner}/${repo}/issues?${params.toString()}`,
		);

		return result.map((issue) => ({
			number: issue.number,
			title: issue.title,
			state: issue.state,
			url: issue.html_url,
			labels: issue.labels.map((l: any) => l.name),
		}));
	}
}
