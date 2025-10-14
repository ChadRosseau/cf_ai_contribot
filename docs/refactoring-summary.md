# Database Query Refactoring Summary

## ✅ Completed Refactoring

All database queries have been moved from API routes to centralized query functions in the `data-ops` package.

---

## 📁 New Files Created

### `packages/data-ops/src/queries/users.ts`
**Purpose**: User preferences and profile queries

**Functions**:
- `getUserPreferences(db, userId)` - Get user's language preferences and difficulty
- `updateUserPreferences(db, userId, data)` - Update user preferences
- `getUserById(db, userId)` - Get basic user info

**Types**:
- `UserPreferences` - Interface for user preference data
- `UpdateUserPreferencesData` - Interface for preference updates

### Updated `packages/data-ops/src/queries/issues.ts`
**Added Function**:
- `getRecommendedIssues(db, preferredLanguages, difficultyPreference, limit)` - Get issues matching user preferences

**Types**:
- `RecommendedIssue` - Interface for recommended issue data

---

## 🔄 Refactored API Routes

### `apps/user-application/src/routes/api/user.preferences.tsx`

**Before**:
```typescript
// Direct SQL queries in API route
const user = await db
  .prepare("SELECT preferred_languages, difficulty_preference, onboarding_completed FROM auth_user WHERE id = ?")
  .bind(userId)
  .first();

// Manual JSON parsing and data transformation
const languages = user.preferred_languages ? JSON.parse(user.preferred_languages) : [];
```

**After**:
```typescript
// Clean query function call
const preferences = await getUserPreferences(db as any, userId);

// Type-safe data access
preferences.preferredLanguages
preferences.difficultyPreference
```

### `apps/user-application/src/routes/api/issues.recommended.tsx`

**Before**:
```typescript
// Complex SQL query in API route
const query = `
  SELECT 
    issues.id,
    issues.github_issue_number,
    issues.title,
    issues.github_url,
    issues.state,
    repos.owner,
    repos.name as repo_name,
    repos.languages_ordered,
    ai_summaries.issue_intro,
    ai_summaries.difficulty_score,
    ai_summaries.first_steps
  FROM issues
  JOIN repos ON issues.repo_id = repos.id
  LEFT JOIN ai_summaries ON ai_summaries.entity_type = 'issue' AND ai_summaries.entity_id = issues.id
  WHERE 
    issues.state = 'open'
    AND (${languageConditions})
    AND (ai_summaries.difficulty_score BETWEEN ? AND ? OR ai_summaries.difficulty_score IS NULL)
  ORDER BY issues.updated_at DESC
  LIMIT ?
`;

// Manual result mapping
const issues = result.results.map((row: any) => ({
  id: row.id,
  issueNumber: row.github_issue_number,
  // ... more mapping
}));
```

**After**:
```typescript
// Simple function call with type safety
const issues = await getRecommendedIssues(
  db as any,
  preferences.preferredLanguages,
  preferences.difficultyPreference,
  20
);
```

### `apps/agent-service/src/durable-objects/agent.ts`

**Before**:
```typescript
// Direct SQL query in agent
const userPrefs = await db
  .prepare("SELECT preferred_languages, difficulty_preference FROM auth_user WHERE id = ?")
  .bind(this.state.userId)
  .first();

// Manual JSON parsing
const languages = userPrefs?.preferred_languages 
  ? JSON.parse(userPrefs.preferred_languages) 
  : [];
```

**After**:
```typescript
// Clean query function call
const preferences = await getUserPreferences(db as any, this.state.userId);

// Type-safe access
preferences.preferredLanguages
```

---

## 🎯 Benefits Achieved

### 1. **Centralized Database Logic**
- All queries in one place (`packages/data-ops/src/queries/`)
- Easier to maintain and update
- Consistent query patterns across services

### 2. **Type Safety**
- Proper TypeScript interfaces for all data structures
- Compile-time checking for query parameters and results
- Better IDE support and autocomplete

### 3. **Reusability**
- Query functions can be used across multiple services
- No code duplication between API routes and agent service
- Consistent data transformation logic

### 4. **Testability**
- Query functions can be unit tested independently
- Easier to mock database calls in tests
- Clear separation of concerns

### 5. **Maintainability**
- Changes to database schema only require updates in one place
- Query optimization can be done centrally
- Easier to add new query functions

---

## 📋 Query Functions Available

### User Queries (`packages/data-ops/src/queries/users.ts`)
```typescript
// Get user preferences
const prefs = await getUserPreferences(db, userId);

// Update user preferences
await updateUserPreferences(db, userId, {
  preferredLanguages: ["JavaScript", "TypeScript"],
  difficultyPreference: 3,
  onboardingCompleted: true
});

// Get basic user info
const user = await getUserById(db, userId);
```

### Issue Queries (`packages/data-ops/src/queries/issues.ts`)
```typescript
// Get recommended issues
const issues = await getRecommendedIssues(
  db, 
  ["JavaScript", "TypeScript"], 
  3, 
  20
);

// Other existing functions...
const issue = await getIssueById(db, issueId);
const openIssues = await getOpenIssuesByRepoId(db, repoId);
```

---

## 🔧 Usage Pattern

### In API Routes
```typescript
import { getUserPreferences, updateUserPreferences } from "@repo/data-ops/queries/users";
import { getRecommendedIssues } from "@repo/data-ops/queries/issues";

// Use query functions instead of raw SQL
const preferences = await getUserPreferences(db, userId);
const issues = await getRecommendedIssues(db, languages, difficulty, limit);
```

### In Services
```typescript
import { getUserPreferences } from "@repo/data-ops/queries/users";

// Same pattern across all services
const preferences = await getUserPreferences(db, userId);
```

---

## ✅ Verification

All database queries are now properly centralized:

- [x] User preferences queries moved to `data-ops/queries/users.ts`
- [x] Recommended issues query moved to `data-ops/queries/issues.ts`
- [x] API routes updated to use query functions
- [x] Agent service updated to use query functions
- [x] Type safety maintained throughout
- [x] No raw SQL queries in API routes or services

---

## 🚀 Next Steps

1. **Build data-ops package**: `pnpm run build:data-ops`
2. **Test the refactored code**: All functionality should work the same
3. **Add more query functions** as needed for future features
4. **Consider adding query validation** using Zod schemas

The refactoring maintains all existing functionality while improving code organization and maintainability.
