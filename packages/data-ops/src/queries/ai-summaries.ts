/**
 * Drizzle queries for ai_summaries table
 */

import { eq, and } from "drizzle-orm";
import { aiSummaries } from "../drizzle/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export interface UpsertSummaryData {
	entityType: "repo" | "issue";
	entityId: number;
	repoSummary?: string;
	issueIntro?: string;
	difficultyScore?: number;
	firstSteps?: string;
}

/**
 * Get summary by entity type and ID
 */
export async function getSummaryByEntityTypeAndId(
	db: DrizzleD1Database,
	entityType: string,
	entityId: number
) {
	const results = await db
		.select()
		.from(aiSummaries)
		.where(
			and(
				eq(aiSummaries.entityType, entityType),
				eq(aiSummaries.entityId, entityId)
			)
		)
		.limit(1);

	return results[0];
}

/**
 * Upsert summary (insert or update)
 */
export async function upsertSummary(
	db: DrizzleD1Database,
	data: UpsertSummaryData
) {
	// Check if exists
	const existing = await getSummaryByEntityTypeAndId(db, data.entityType, data.entityId);

	if (existing) {
		// Update
		const result = await db
			.update(aiSummaries)
			.set({
				repoSummary: data.repoSummary,
				issueIntro: data.issueIntro,
				difficultyScore: data.difficultyScore,
				firstSteps: data.firstSteps,
			})
			.where(eq(aiSummaries.id, existing.id))
			.returning();

		return result[0];
	} else {
		// Insert
		const result = await db
			.insert(aiSummaries)
			.values({
				entityType: data.entityType,
				entityId: data.entityId,
				repoSummary: data.repoSummary || null,
				issueIntro: data.issueIntro || null,
				difficultyScore: data.difficultyScore || null,
				firstSteps: data.firstSteps || null,
			})
			.returning();

		return result[0];
	}
}

/**
 * Store repo summary
 */
export async function storeRepoSummary(
	db: DrizzleD1Database,
	repoId: number,
	summary: string
) {
	return upsertSummary(db, {
		entityType: "repo",
		entityId: repoId,
		repoSummary: summary,
	});
}

/**
 * Store issue summary
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
	return upsertSummary(db, {
		entityType: "issue",
		entityId: issueId,
		issueIntro: data.issueIntro,
		difficultyScore: data.difficultyScore,
		firstSteps: data.firstSteps,
	});
}

