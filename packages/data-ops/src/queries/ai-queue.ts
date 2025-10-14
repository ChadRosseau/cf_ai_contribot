/**
 * ⚠️ DEPRECATED - DO NOT USE ⚠️
 *
 * This file is no longer used in the new architecture.
 * The aiSummaryQueue table has been removed.
 * Use ai-summaries.ts instead.
 *
 * This file will be deleted after migration is verified.
 * All functions below are stubs to prevent build errors.
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";

// Stub interfaces to prevent errors in old code
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

// Stub functions - throw deprecation errors
export async function enqueueRepo(db: DrizzleD1Database, repoId: number) {
	throw new Error("DEPRECATED: enqueueRepo - use queue messages instead");
}

export async function enqueueIssue(db: DrizzleD1Database, issueId: number) {
	throw new Error("DEPRECATED: enqueueIssue - use queue messages instead");
}

export async function enqueueForAISummary(
	db: DrizzleD1Database,
	data: CreateQueueItemData,
) {
	throw new Error(
		"DEPRECATED: enqueueForAISummary - use queue messages instead",
	);
}

export async function findQueueItem(
	db: DrizzleD1Database,
	entityType: string,
	entityId: number,
) {
	throw new Error("DEPRECATED: findQueueItem - no longer used");
}

export async function getPendingQueueItems(
	db: DrizzleD1Database,
	limit: number = 10,
) {
	throw new Error("DEPRECATED: getPendingQueueItems - no longer used");
}

export async function markQueueItemProcessing(
	db: DrizzleD1Database,
	id: number,
) {
	throw new Error("DEPRECATED: markQueueItemProcessing - no longer used");
}

export async function completeQueueItem(db: DrizzleD1Database, id: number) {
	throw new Error("DEPRECATED: completeQueueItem - no longer used");
}

export async function failQueueItem(
	db: DrizzleD1Database,
	id: number,
	errorMessage: string,
	attempts: number,
) {
	throw new Error("DEPRECATED: failQueueItem - no longer used");
}

export async function resetStuckItems(
	db: DrizzleD1Database,
	timeoutMs: number,
) {
	throw new Error("DEPRECATED: resetStuckItems - no longer used");
}

export async function getQueueStats(db: DrizzleD1Database) {
	throw new Error("DEPRECATED: getQueueStats - no longer used");
}

export async function storeRepoSummary(
	db: DrizzleD1Database,
	repoId: number,
	summary: string,
) {
	throw new Error("DEPRECATED: storeRepoSummary - use ai-summaries.ts instead");
}

export async function storeIssueSummary(
	db: DrizzleD1Database,
	issueId: number,
	data: {
		issueIntro: string;
		difficultyScore: number;
		firstSteps: string;
	},
) {
	throw new Error(
		"DEPRECATED: storeIssueSummary - use ai-summaries.ts instead",
	);
}
