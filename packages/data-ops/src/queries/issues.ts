/**
 * Drizzle queries for issues table
 */

import { eq, and } from "drizzle-orm";
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

