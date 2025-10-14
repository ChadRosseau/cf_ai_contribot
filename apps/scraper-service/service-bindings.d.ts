interface Env extends Cloudflare.Env {
	// D1 Database
	DB: D1Database;

	// R2 Bucket for workflow logs
	WORKFLOW_LOGS: R2Bucket;

	// Queue for sending processing tasks to data-service
	PROCESSING_QUEUE: Queue<ProcessingQueueMessage>;

	// Environment variables
	GITHUB_SCRAPER_TOKEN: string;
	ENABLE_R2_LOGGING: string;
}

// Processing queue message types (sent to data-service)
type ProcessingQueueMessage =
	| { type: "process_repo"; repoId: number }
	| { type: "process_issue"; issueId: number };
