/**
 * Drizzle queries for user favourites table
 */

import { eq, and } from "drizzle-orm";
import { userFavourites } from "../drizzle/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";

/**
 * Get all favourites for a user
 */
export async function getUserFavourites(db: DrizzleD1Database, userId: string) {
	const results = await db
		.select()
		.from(userFavourites)
		.where(eq(userFavourites.userId, userId));

	const repos: number[] = [];
	const issues: number[] = [];

	for (const fav of results) {
		if (fav.entityType === "repo") {
			repos.push(fav.entityId);
		} else if (fav.entityType === "issue") {
			issues.push(fav.entityId);
		}
	}

	return { repos, issues };
}

/**
 * Add a favourite (repo or issue)
 */
export async function addFavourite(
	db: DrizzleD1Database,
	userId: string,
	entityType: "repo" | "issue",
	entityId: number,
) {
	try {
		const result = await db
			.insert(userFavourites)
			.values({
				userId,
				entityType,
				entityId,
			})
			.returning();
		return result[0];
	} catch (error) {
		// Ignore unique constraint violations (already favourited)
		console.warn("Favourite may already exist:", error);
		return null;
	}
}

/**
 * Remove a favourite (repo or issue)
 */
export async function removeFavourite(
	db: DrizzleD1Database,
	userId: string,
	entityType: "repo" | "issue",
	entityId: number,
) {
	const result = await db
		.delete(userFavourites)
		.where(
			and(
				eq(userFavourites.userId, userId),
				eq(userFavourites.entityType, entityType),
				eq(userFavourites.entityId, entityId),
			),
		)
		.returning();

	return result[0];
}

/**
 * Toggle favourite status
 */
export async function toggleFavourite(
	db: DrizzleD1Database,
	userId: string,
	entityType: "repo" | "issue",
	entityId: number,
	favourite: boolean,
) {
	if (favourite) {
		return addFavourite(db, userId, entityType, entityId);
	} else {
		return removeFavourite(db, userId, entityType, entityId);
	}
}

/**
 * Check if an entity is favourited by a user
 */
export async function isFavourited(
	db: DrizzleD1Database,
	userId: string,
	entityType: "repo" | "issue",
	entityId: number,
): Promise<boolean> {
	const result = await db
		.select()
		.from(userFavourites)
		.where(
			and(
				eq(userFavourites.userId, userId),
				eq(userFavourites.entityType, entityType),
				eq(userFavourites.entityId, entityId),
			),
		)
		.limit(1);

	return result.length > 0;
}
