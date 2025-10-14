# User Preferences Schema Extension

## Overview
The user onboarding flow collects language preferences and difficulty level. These need to be stored in the database for matching users with appropriate issues.

## Required Schema Changes

### Option 1: Extend `auth_user` table (Recommended)
Add the following columns to the existing `auth_user` table:

```typescript
export const auth_user = sqliteTable("auth_user", {
  // ... existing fields ...
  
  // Onboarding preferences
  preferredLanguages: text("preferred_languages", { mode: "json" })
    .$type<string[]>()
    .default([]),
  difficultyPreference: integer("difficulty_preference")
    .default(3), // 1-5 scale, default to medium
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
    .notNull()
    .default(false),
  onboardedAt: integer("onboarded_at", { mode: "timestamp_ms" }),
});
```

### Option 2: Separate `user_preferences` table
Create a new table with a 1-to-1 relationship:

```typescript
export const userPreferences = sqliteTable("user_preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => auth_user.id, { onDelete: "cascade" })
    .unique(),
  preferredLanguages: text("preferred_languages", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  difficultyPreference: integer("difficulty_preference")
    .notNull()
    .default(3),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date()),
});
```

## Queries Needed

### Get User Preferences
```typescript
export async function getUserPreferences(db: DrizzleD1Database, userId: string) {
  return await db.select().from(auth_user).where(eq(auth_user.id, userId)).get();
  // or from userPreferences if using Option 2
}
```

### Update User Preferences
```typescript
export async function updateUserPreferences(
  db: DrizzleD1Database, 
  userId: string,
  data: {
    preferredLanguages?: string[];
    difficultyPreference?: number;
    onboardingCompleted?: boolean;
  }
) {
  return await db
    .update(auth_user)
    .set({
      ...data,
      onboardedAt: data.onboardingCompleted ? new Date() : undefined,
    })
    .where(eq(auth_user.id, userId))
    .returning();
}
```

## Recommendation
Use **Option 1** (extend auth_user) for simplicity, as these are core user attributes needed on every request.

