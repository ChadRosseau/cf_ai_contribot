/**
 * Drizzle queries for repos table
 */

import { eq, and, asc } from "drizzle-orm";
import { repos } from "../drizzle/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export interface CreateRepoData {
	owner: string;
	name: string;
	githubUrl: string;
	languagesOrdered: string[] | null;
	languagesRaw: Record<string, number> | null;
	goodFirstIssueTag: string;
	dataSourceId: string;
	openIssuesCount: number | null;
	metadataHash: string;
}

export interface UpdateRepoData {
	languagesOrdered?: string[] | null;
	languagesRaw?: Record<string, number> | null;
	goodFirstIssueTag?: string;
	dataSourceId?: string;
	openIssuesCount?: number | null;
	metadataHash?: string;
}

/**
 * Find repo by owner and name
 */
export async function findRepoByOwnerName(
	db: DrizzleD1Database,
	owner: string,
	name: string
) {
	const results = await db
		.select()
		.from(repos)
		.where(and(eq(repos.owner, owner), eq(repos.name, name)))
		.limit(1);

	return results[0];
}

/**
 * Find repo by metadata hash
 */
export async function findRepoByHash(
	db: DrizzleD1Database,
	metadataHash: string
) {
	const results = await db
		.select()
		.from(repos)
		.where(eq(repos.metadataHash, metadataHash))
		.limit(1);

	return results[0];
}

/**
 * Create a new repo
 */
export async function createRepo(
	db: DrizzleD1Database,
	data: CreateRepoData
) {
	const result = await db.insert(repos).values(data).returning();
	return result[0];
}

/**
 * Alias for createRepo (for compatibility)
 */
export const insertRepo = createRepo;

/**
 * Update an existing repo
 */
export async function updateRepo(
	db: DrizzleD1Database,
	id: number,
	data: UpdateRepoData
) {
	const result = await db
		.update(repos)
		.set(data)
		.where(eq(repos.id, id))
		.returning();

	return result[0];
}

/**
 * Get all repos
 */
export async function getAllRepos(db: DrizzleD1Database) {
	return db.select().from(repos);
}

/**
 * Get repo by ID
 */
export async function getRepoById(db: DrizzleD1Database, id: number) {
	const results = await db
		.select()
		.from(repos)
		.where(eq(repos.id, id))
		.limit(1);

	return results[0];
}

/**
 * Get repos by processing status, ordered by least recently updated
 */
export async function getReposByStatus(
	db: DrizzleD1Database,
	status: string,
	limit: number
) {
	return db
		.select()
		.from(repos)
		.where(eq(repos.processingStatus, status))
		.orderBy(asc(repos.updatedAt))
		.limit(limit);
}

/**
 * Update repo processing status
 */
export async function updateRepoProcessingStatus(
	db: DrizzleD1Database,
	id: number,
	status: string,
	processedAt?: Date
) {
	const result = await db
		.update(repos)
		.set({
			processingStatus: status,
			processedAt: processedAt || null,
		})
		.where(eq(repos.id, id))
		.returning();

	return result[0];
}

