/**
 * Drizzle queries for AI summary queue
 */

import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import { aiSummaryQueue, aiSummaries } from "../drizzle/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export interface CreateQueueItemData {
	entityType: "repo" | "issue";
	entityId: number;
	priority?: number;
}

export interface UpdateQueueItemData {
	status?: "pending" | "processing" | "completed" | "failed";
	attempts?: number;
	errorMessage?: string | null;
	processedAt?: Date | null;
}

/**
 * Enqueue a repo for AI processing
 */
export async function enqueueRepo(db: DrizzleD1Database, repoId: number) {
	// Check if already in queue
	const existing = await findQueueItem(db, "repo", repoId);
	if (existing) {
		console.log(`Repo ${repoId} already in queue`);
		return existing;
	}

	const result = await db
		.insert(aiSummaryQueue)
		.values({
			entityType: "repo",
			entityId: repoId,
			status: "pending",
			priority: 0,
			attempts: 0,
		})
		.returning();

	return result[0];
}

/**
 * Enqueue an issue for AI processing
 */
export async function enqueueIssue(db: DrizzleD1Database, issueId: number) {
	// Check if already in queue
	const existing = await findQueueItem(db, "issue", issueId);
	if (existing) {
		console.log(`Issue ${issueId} already in queue`);
		return existing;
	}

	const result = await db
		.insert(aiSummaryQueue)
		.values({
			entityType: "issue",
			entityId: issueId,
			status: "pending",
			priority: 0,
			attempts: 0,
		})
		.returning();

	return result[0];
}

/**
 * Find a queue item by entity type and ID
 */
export async function findQueueItem(
	db: DrizzleD1Database,
	entityType: "repo" | "issue",
	entityId: number
) {
	const results = await db
		.select()
		.from(aiSummaryQueue)
		.where(
			and(
				eq(aiSummaryQueue.entityType, entityType),
				eq(aiSummaryQueue.entityId, entityId)
			)
		)
		.limit(1);

	return results[0];
}

/**
 * Get pending queue items (batch)
 */
export async function getPendingQueueItems(
	db: DrizzleD1Database,
	limit = 10
) {
	return db
		.select()
		.from(aiSummaryQueue)
		.where(eq(aiSummaryQueue.status, "pending"))
		.orderBy(desc(aiSummaryQueue.priority), asc(aiSummaryQueue.createdAt))
		.limit(limit);
}

/**
 * Mark queue item as processing
 */
export async function markQueueItemProcessing(
	db: DrizzleD1Database,
	id: number
) {
	const result = await db
		.update(aiSummaryQueue)
		.set({
			status: "processing",
		})
		.where(eq(aiSummaryQueue.id, id))
		.returning();

	return result[0];
}

/**
 * Mark queue item as completed
 */
export async function completeQueueItem(db: DrizzleD1Database, id: number) {
	const result = await db
		.update(aiSummaryQueue)
		.set({
			status: "completed",
			processedAt: new Date(),
		})
		.where(eq(aiSummaryQueue.id, id))
		.returning();

	return result[0];
}

/**
 * Mark queue item as failed
 */
export async function failQueueItem(
	db: DrizzleD1Database,
	id: number,
	errorMessage: string,
	attempts: number
) {
	const maxAttempts = 3;
	const status = attempts >= maxAttempts ? "failed" : "pending";

	const result = await db
		.update(aiSummaryQueue)
		.set({
			status,
			attempts,
			errorMessage,
			processedAt: attempts >= maxAttempts ? new Date() : null,
		})
		.where(eq(aiSummaryQueue.id, id))
		.returning();

	return result[0];
}

/**
 * Get queue statistics
 */
export async function getQueueStats(db: DrizzleD1Database) {
	const stats = await db
		.select({
			status: aiSummaryQueue.status,
			count: sql<number>`count(*)`,
		})
		.from(aiSummaryQueue)
		.groupBy(aiSummaryQueue.status);

	return stats;
}

/**
 * Store AI summary for a repo
 */
export async function storeRepoSummary(
	db: DrizzleD1Database,
	repoId: number,
	summary: string
) {
	// Check if summary exists
	const existing = await db
		.select()
		.from(aiSummaries)
		.where(
			and(
				eq(aiSummaries.entityType, "repo"),
				eq(aiSummaries.entityId, repoId)
			)
		)
		.limit(1);

	if (existing.length > 0) {
		// Update existing
		const result = await db
			.update(aiSummaries)
			.set({
				repoSummary: summary,
			})
			.where(eq(aiSummaries.id, existing[0].id))
			.returning();

		return result[0];
	} else {
		// Insert new
		const result = await db
			.insert(aiSummaries)
			.values({
				entityType: "repo",
				entityId: repoId,
				repoSummary: summary,
			})
			.returning();

		return result[0];
	}
}

/**
 * Store AI summary for an issue
 */
export async function storeIssueSummary(
	db: DrizzleD1Database,
	issueId: number,
	data: {
		issueIntro: string;
		difficultyScore: number;
		firstSteps: string;
	}
) {
	// Check if summary exists
	const existing = await db
		.select()
		.from(aiSummaries)
		.where(
			and(
				eq(aiSummaries.entityType, "issue"),
				eq(aiSummaries.entityId, issueId)
			)
		)
		.limit(1);

	if (existing.length > 0) {
		// Update existing
		const result = await db
			.update(aiSummaries)
			.set(data)
			.where(eq(aiSummaries.id, existing[0].id))
			.returning();

		return result[0];
	} else {
		// Insert new
		const result = await db
			.insert(aiSummaries)
			.values({
				entityType: "issue",
				entityId: issueId,
				...data,
			})
			.returning();

		return result[0];
	}
}

