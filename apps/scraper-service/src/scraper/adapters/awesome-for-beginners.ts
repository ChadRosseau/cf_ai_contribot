/**
 * Adapter for awesome-for-beginners data source
 * Fetches and parses data.json from the GitHub repository
 */

import type { ScraperAdapter, RepoSourceData } from "./base-adapter";

interface AwesomeRepository {
	name: string;
	link: string;
	label: string;
	technologies: string[];
	description: string;
}

interface AwesomeData {
	sponsors?: unknown[];
	technologies?: Record<string, string>;
	repositories: AwesomeRepository[];
}

export class AwesomeForBeginnersAdapter implements ScraperAdapter {
	id = "awesome-for-beginners";
	name = "Awesome for Beginners";

	async fetch(url: string): Promise<RepoSourceData[]> {
		try {
			console.log(`Fetching data from ${url}`);
			
			const response = await fetch(url);
			
			if (!response.ok) {
				throw new Error(
					`Failed to fetch data: ${response.status} ${response.statusText}`
				);
			}

			const data = (await response.json()) as AwesomeData;
			
			return this.parseData(data);
		} catch (error) {
			console.error("Error fetching awesome-for-beginners data:", error);
			throw error;
		}
	}

	private parseData(data: AwesomeData): RepoSourceData[] {
		if (!data.repositories || !Array.isArray(data.repositories)) {
			console.error("No repositories array found in data");
			return [];
		}

		const results: RepoSourceData[] = [];

		for (const repo of data.repositories) {
			try {
				const parsed = this.parseEntry(repo);
				if (parsed) {
					results.push(parsed);
				}
			} catch (error) {
				console.warn("Failed to parse entry:", repo, error);
			}
		}

		console.log(`Parsed ${results.length} repos from ${this.name}`);
		return results;
	}

	private parseEntry(repo: AwesomeRepository): RepoSourceData | null {
		// Extract owner and repo name from link
		// Format: https://github.com/owner/repo
		const match = repo.link.match(/github\.com\/([^/]+)\/([^/\s?#]+)/i);
		if (!match) {
			console.warn(`Could not parse GitHub URL: ${repo.link}`);
			return null;
		}

		const [, owner, name] = match;

		return {
			owner,
			name,
			dataSourceId: this.id,
			goodFirstIssueTag: repo.label,
		};
	}
}

