/**
 * Base adapter interface for data sources
 * Each data source implements this interface to provide a consistent contract
 */

export interface RepoSourceData {
	name: string;
	owner: string;
	dataSourceId: string;
	goodFirstIssueTag: string;
}

export interface ScraperAdapter {
	id: string;
	name: string;
	fetch(url: string): Promise<RepoSourceData[]>;
}
