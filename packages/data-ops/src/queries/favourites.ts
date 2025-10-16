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

/**
 * Get favourited repos with full details
 */
export async function getFavouritedRepos(
	db: DrizzleD1Database,
	userId: string,
): Promise<
	Array<{
		id: number;
		owner: string;
		name: string;
		githubUrl: string;
		languages: string[];
		openIssuesCount: number;
		favouritedAt: Date;
	}>
> {
	const { repos } = await import("../drizzle/schema");

	const result = await db
		.select({
			id: repos.id,
			owner: repos.owner,
			name: repos.name,
			githubUrl: repos.githubUrl,
			languages: repos.languagesOrdered,
			openIssuesCount: repos.openIssuesCount,
			favouritedAt: userFavourites.createdAt,
		})
		.from(userFavourites)
		.innerJoin(repos, eq(userFavourites.entityId, repos.id))
		.where(
			and(
				eq(userFavourites.userId, userId),
				eq(userFavourites.entityType, "repo"),
			),
		)
		.orderBy(userFavourites.createdAt);

	return result.map((row) => ({
		id: row.id,
		owner: row.owner,
		name: row.name,
		githubUrl: row.githubUrl,
		languages: row.languages || [],
		openIssuesCount: row.openIssuesCount || 0,
		favouritedAt: row.favouritedAt,
	}));
}

/**
 * Get favourited issues with full details
 */
export async function getFavouritedIssues(
	db: DrizzleD1Database,
	userId: string,
): Promise<
	Array<{
		id: number;
		issueNumber: number;
		title: string;
		url: string;
		owner: string;
		repoName: string;
		state: string;
		favouritedAt: Date;
	}>
> {
	const { issues, repos } = await import("../drizzle/schema");

	const result = await db
		.select({
			id: issues.id,
			issueNumber: issues.githubIssueNumber,
			title: issues.title,
			url: issues.githubUrl,
			owner: repos.owner,
			repoName: repos.name,
			state: issues.state,
			favouritedAt: userFavourites.createdAt,
		})
		.from(userFavourites)
		.innerJoin(issues, eq(userFavourites.entityId, issues.id))
		.innerJoin(repos, eq(issues.repoId, repos.id))
		.where(
			and(
				eq(userFavourites.userId, userId),
				eq(userFavourites.entityType, "issue"),
			),
		)
		.orderBy(userFavourites.createdAt);

	return result.map((row) => ({
		id: row.id,
		issueNumber: row.issueNumber,
		title: row.title,
		url: row.url,
		owner: row.owner,
		repoName: row.repoName,
		state: row.state,
		favouritedAt: row.favouritedAt,
	}));
}
