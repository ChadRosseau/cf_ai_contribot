interface Env extends Cloudflare.Env {
	// D1 Database
	DB: D1Database;

	// Workers AI
	AI: Ai;

	// R2 Bucket for logs
	WORKFLOW_LOGS: R2Bucket;

	// Queue for processing (producer - sends issue processing messages)
	PROCESSING_QUEUE: Queue<ProcessingQueueMessage>;

	// Environment variables
	GITHUB_SCRAPER_TOKEN: string;
	ENABLE_R2_LOGGING: string;
}

// Processing queue message types
type ProcessingQueueMessage =
	| { type: "process_repo"; repoId: number }
	| { type: "process_issue"; issueId: number };
