/**
 * Drizzle queries for issues table
 */

import { eq, and, asc } from "drizzle-orm";
import { issues } from "../drizzle/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export interface CreateIssueData {
	repoId: number;
	githubIssueNumber: number;
	title: string;
	body: string | null;
	state: string;
	commentCount: number;
	assigneeStatus: string[] | null;
	githubUrl: string;
	metadataHash: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface UpdateIssueData {
	title: string;
	body: string | null;
	state: string;
	commentCount: number;
	assigneeStatus: string[] | null;
	metadataHash: string;
	updatedAt: Date;
}

/**
 * Find issue by repo ID and issue number
 */
export async function findIssueByRepoAndNumber(
	db: DrizzleD1Database,
	repoId: number,
	githubIssueNumber: number
) {
	const results = await db
		.select()
		.from(issues)
		.where(
			and(
				eq(issues.repoId, repoId),
				eq(issues.githubIssueNumber, githubIssueNumber)
			)
		)
		.limit(1);

	return results[0];
}

/**
 * Create a new issue
 */
export async function createIssue(
	db: DrizzleD1Database,
	data: CreateIssueData
) {
	const result = await db.insert(issues).values(data).returning();
	return result[0];
}

/**
 * Batch create multiple issues
 */
export async function batchCreateIssues(
	db: DrizzleD1Database,
	data: CreateIssueData[]
) {
	if (data.length === 0) return [];
	
	const result = await db.insert(issues).values(data).returning();
	return result;
}

/**
 * Update an existing issue
 */
export async function updateIssue(
	db: DrizzleD1Database,
	id: number,
	data: UpdateIssueData
) {
	const result = await db
		.update(issues)
		.set({
			...data,
			scrapedAt: new Date(),
		})
		.where(eq(issues.id, id))
		.returning();

	return result[0];
}

/**
 * Batch find issues by repo ID and issue numbers
 */
export async function batchFindIssuesByNumbers(
	db: DrizzleD1Database,
	repoId: number,
	issueNumbers: number[]
): Promise<Map<number, typeof issues.$inferSelect>> {
	if (issueNumbers.length === 0) return new Map();
	
	const results = await db
		.select()
		.from(issues)
		.where(eq(issues.repoId, repoId));
	
	const issueMap = new Map<number, typeof issues.$inferSelect>();
	for (const issue of results) {
		if (issueNumbers.includes(issue.githubIssueNumber)) {
			issueMap.set(issue.githubIssueNumber, issue);
		}
	}
	
	return issueMap;
}

/**
 * Get all issues for a repo
 */
export async function getIssuesByRepoId(
	db: DrizzleD1Database,
	repoId: number
) {
	return db.select().from(issues).where(eq(issues.repoId, repoId));
}

/**
 * Get issue by ID
 */
export async function getIssueById(db: DrizzleD1Database, id: number) {
	const results = await db
		.select()
		.from(issues)
		.where(eq(issues.id, id))
		.limit(1);

	return results[0];
}

/**
 * Get all open issues
 */
export async function getOpenIssues(db: DrizzleD1Database) {
	return db.select().from(issues).where(eq(issues.state, "open"));
}

/**
 * Get all open issues for a specific repo
 */
export async function getOpenIssuesByRepoId(
	db: DrizzleD1Database,
	repoId: number
) {
	return db
		.select()
		.from(issues)
		.where(and(eq(issues.repoId, repoId), eq(issues.state, "open")));
}

/**
 * Get issues by processing status, ordered by least recently updated
 */
export async function getIssuesByStatus(
	db: DrizzleD1Database,
	status: string,
	limit: number
) {
	return db
		.select()
		.from(issues)
		.where(eq(issues.processingStatus, status))
		.orderBy(asc(issues.updatedAt))
		.limit(limit);
}

/**
 * Update issue processing status
 */
export async function updateIssueProcessingStatus(
	db: DrizzleD1Database,
	id: number,
	status: string,
	processedAt?: Date
) {
	const result = await db
		.update(issues)
		.set({
			processingStatus: status,
			processedAt: processedAt || null,
		})
		.where(eq(issues.id, id))
		.returning();

	return result[0];
}

