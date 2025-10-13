import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Repositories table - stores unique repos discovered from data sources
export const repos = sqliteTable(
  "repos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    githubUrl: text("github_url").notNull(),
    languagesOrdered: text("languages_ordered", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    languagesRaw: text("languages_raw", { mode: "json" })
      .$type<Record<string, number>>()
      .notNull(),
    goodFirstIssueTag: text("good_first_issue_tag").notNull(),
    dataSourceId: text("data_source_id").notNull(),
    metadataHash: text("metadata_hash").notNull().unique(),
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
  })
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
    assigneeStatus: text("assignee_status", { mode: "json" }).$type<string[] | null>(),
    githubUrl: text("github_url").notNull(),
    metadataHash: text("metadata_hash").notNull(),
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
  })
);

// AI summary queue - decouples scraping from AI processing
export const aiSummaryQueue = sqliteTable(
  "ai_summary_queue",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityType: text("entity_type").notNull(), // "repo" or "issue"
    entityId: integer("entity_id").notNull(),
    status: text("status").notNull().default("pending"), // "pending", "processing", "completed", "failed"
    priority: integer("priority").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    statusPriorityIdx: index("ai_queue_status_priority_idx").on(
      table.status,
      table.priority,
      table.createdAt
    ),
    entityTypeIdIdx: index("ai_queue_entity_type_id_idx").on(
      table.entityType,
      table.entityId
    ),
  })
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
      table.difficultyScore
    ),
  })
);


