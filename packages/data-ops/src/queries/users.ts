/**
 * User queries for Contribot
 * Handles user preferences and profile data
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { auth_user, auth_account } from "../drizzle/auth-schema";

export interface UserPreferences {
	preferredLanguages: string[];
	difficultyPreference: number;
	onboardingCompleted: boolean;
	onboardedAt?: number;
}

export interface UpdateUserPreferencesData {
	preferredLanguages?: string[];
	difficultyPreference?: number;
	onboardingCompleted?: boolean;
}

export interface UserGitHubTokens {
	accessToken: string;
	refreshToken?: string;
	expiresAt?: number;
}

/**
 * Get user preferences by user ID
 */
export async function getUserPreferences(
	db: DrizzleD1Database,
	userId: string
): Promise<UserPreferences | null> {
	try {
		const user = await db
			.select({
				preferredLanguages: auth_user.preferredLanguages,
				difficultyPreference: auth_user.difficultyPreference,
				onboardingCompleted: auth_user.onboardingCompleted,
				onboardedAt: auth_user.onboardedAt,
			})
			.from(auth_user)
			.where(eq(auth_user.id, userId))
			.get();

		if (!user) {
			return null;
		}

		return {
			preferredLanguages: user.preferredLanguages || [],
			difficultyPreference: user.difficultyPreference || 3,
			onboardingCompleted: Boolean(user.onboardingCompleted),
			onboardedAt: user.onboardedAt ? user.onboardedAt.getTime() : undefined,
		};
	} catch (error) {
		console.error(`Failed to get user preferences for user ${userId}:`, error);
		throw error;
	}
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
	db: DrizzleD1Database,
	userId: string,
	data: UpdateUserPreferencesData
): Promise<void> {
	try {
		const updates: Record<string, any> = {};

		if (data.preferredLanguages !== undefined) {
			updates.preferredLanguages = JSON.stringify(data.preferredLanguages);
		}

		if (data.difficultyPreference !== undefined) {
			updates.difficultyPreference = data.difficultyPreference;
		}

		if (data.onboardingCompleted !== undefined) {
			updates.onboardingCompleted = data.onboardingCompleted;
			if (data.onboardingCompleted) {
				updates.onboardedAt = Date.now();
			}
		}

		await db
			.update(auth_user)
			.set(updates)
			.where(eq(auth_user.id, userId))
			.run();
	} catch (error) {
		console.error(`Failed to update user preferences for user ${userId}:`, error);
		throw error;
	}
}

/**
 * Get user by ID (basic info)
 */
export async function getUserById(
	db: DrizzleD1Database,
	userId: string
): Promise<{ id: string; email: string | null; name: string | null } | null> {
	try {
		const user = await db
			.select({
				id: auth_user.id,
				email: auth_user.email,
				name: auth_user.name,
			})
			.from(auth_user)
			.where(eq(auth_user.id, userId))
			.get();

		return user || null;
	} catch (error) {
		console.error(`Failed to get user by ID ${userId}:`, error);
		throw error;
	}
}

/**
 * Get user GitHub tokens from auth_account table
 */
export async function getUserGitHubTokens(
	db: DrizzleD1Database,
	userId: string
): Promise<UserGitHubTokens | null> {
	try {
		const result = await db
			.select({
				accessToken: auth_account.accessToken,
				refreshToken: auth_account.refreshToken,
				expiresAt: auth_account.accessTokenExpiresAt,
			})
			.from(auth_account)
			.where(
				and(
					eq(auth_account.userId, userId),
					eq(auth_account.providerId, "github")
				)
			)
			.limit(1)
			.get();

		if (!result || !result.accessToken) {
			return null;
		}

		return {
			accessToken: result.accessToken,
			refreshToken: result.refreshToken || undefined,
			expiresAt: result.expiresAt ? result.expiresAt.getTime() : undefined,
		};
	} catch (error) {
		console.error(`Failed to retrieve GitHub tokens for user ${userId}:`, error);
		throw error;
	}
}

/**
 * Check if a token is expired
 */
export async function isTokenExpired(expiresAt?: number): Promise<boolean> {
	if (!expiresAt) return false;
	return Date.now() >= expiresAt;
}
