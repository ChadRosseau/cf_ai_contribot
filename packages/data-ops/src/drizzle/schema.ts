import {
	sqliteTable,
	text,
	integer,
	index,
	unique,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Repositories table - stores unique repos discovered from data sources
export const repos = sqliteTable(
	"repos",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		owner: text("owner").notNull(),
		name: text("name").notNull(),
		githubUrl: text("github_url").notNull(),
		languagesOrdered: text("languages_ordered", { mode: "json" }).$type<
			string[]
		>(),
		languagesRaw: text("languages_raw", { mode: "json" }).$type<
			Record<string, number>
		>(),
		goodFirstIssueTag: text("good_first_issue_tag").notNull(),
		dataSourceId: text("data_source_id").notNull(),
		openIssuesCount: integer("open_issues_count"),
		metadataHash: text("metadata_hash").notNull().unique(),
		processingStatus: text("processing_status").notNull().default("pending"),
		processedAt: integer("processed_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date()),
	},
	(table) => ({
		ownerNameUnique: unique().on(table.owner, table.name),
		metadataHashIdx: index("repos_metadata_hash_idx").on(table.metadataHash),
		processingStatusIdx: index("repos_processing_status_idx").on(
			table.processingStatus,
		),
		updatedAtIdx: index("repos_updated_at_idx").on(table.updatedAt),
	}),
);

// Issues table - stores individual issues with good-first-issue labels
export const issues = sqliteTable(
	"issues",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		repoId: integer("repo_id")
			.notNull()
			.references(() => repos.id, { onDelete: "cascade" }),
		githubIssueNumber: integer("github_issue_number").notNull(),
		title: text("title").notNull(),
		body: text("body"),
		state: text("state").notNull(),
		commentCount: integer("comment_count").notNull(),
		assigneeStatus: text("assignee_status", { mode: "json" }).$type<
			string[] | null
		>(),
		githubUrl: text("github_url").notNull(),
		metadataHash: text("metadata_hash").notNull(),
		processingStatus: text("processing_status").notNull().default("pending"),
		processedAt: integer("processed_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
		scrapedAt: integer("scraped_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	},
	(table) => ({
		repoIssueUnique: unique().on(table.repoId, table.githubIssueNumber),
		metadataHashIdx: index("issues_metadata_hash_idx").on(table.metadataHash),
		stateIdx: index("issues_state_idx").on(table.state),
		repoIdIdx: index("issues_repo_id_idx").on(table.repoId),
		processingStatusIdx: index("issues_processing_status_idx").on(
			table.processingStatus,
		),
		updatedAtIdx: index("issues_updated_at_idx").on(table.updatedAt),
	}),
);

// AI summaries - stores AI-generated content for repos and issues
export const aiSummaries = sqliteTable(
	"ai_summaries",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		entityType: text("entity_type").notNull(), // "repo" or "issue"
		entityId: integer("entity_id").notNull(),
		repoSummary: text("repo_summary"),
		issueIntro: text("issue_intro"),
		difficultyScore: integer("difficulty_score"),
		firstSteps: text("first_steps"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date()),
	},
	(table) => ({
		entityTypeIdUnique: unique().on(table.entityType, table.entityId),
		difficultyScoreIdx: index("ai_summaries_difficulty_score_idx").on(
			table.difficultyScore,
		),
	}),
);

// User favourites - stores user's starred repos and issues
export const userFavourites = sqliteTable(
	"user_favourites",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		userId: text("user_id").notNull(),
		entityType: text("entity_type").notNull(), // "repo" or "issue"
		entityId: integer("entity_id").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	},
	(table) => ({
		userEntityUnique: unique().on(
			table.userId,
			table.entityType,
			table.entityId,
		),
		userIdIdx: index("user_favourites_user_id_idx").on(table.userId),
		entityTypeIdIdx: index("user_favourites_entity_type_id_idx").on(
			table.entityType,
			table.entityId,
		),
	}),
);
