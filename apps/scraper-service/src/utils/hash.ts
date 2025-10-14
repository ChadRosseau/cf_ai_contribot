/**
 * Hashing utilities for change detection
 * Uses SHA-256 to create deterministic hashes of metadata
 */

export async function sha256(data: string): Promise<string> {
	const encoder = new TextEncoder();
	const dataBuffer = encoder.encode(data);
	const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate hash for repo metadata (scraper-service only needs data source info)
 */
export async function hashRepoMetadata(
	owner: string,
	name: string,
	goodFirstIssueTag: string,
	dataSourceId: string,
): Promise<string> {
	const data = JSON.stringify({
		owner,
		name,
		goodFirstIssueTag,
		dataSourceId,
	});
	return sha256(data);
}

/**
 * Generate hash for issue metadata
 * Hash includes: comment count, state, and assignee status
 */
export async function hashIssueMetadata(
	commentCount: number,
	state: string,
	assigneeStatus: string[] | null,
): Promise<string> {
	const data = JSON.stringify({
		commentCount,
		state,
		assigneeStatus,
	});
	return sha256(data);
}
