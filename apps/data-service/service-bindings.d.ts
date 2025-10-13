interface ExampleWorkflowParmas {
  dataToPassIn: unknown;
}

interface ScraperWorkflowParams {
  triggeredAt: string;
}

interface Env extends Cloudflare.Env {
  // D1 Database
  DB: D1Database;
  
  // Workers AI
  AI: Ai;
  
  // R2 Bucket for workflow logs
  WORKFLOW_LOGS: R2Bucket;
  
  // Workflow bindings
  SCRAPER_WORKFLOW: Workflow;
  
  // Environment variables
  GITHUB_SCRAPER_TOKEN: string;
  ENABLE_R2_LOGGING: string;
}
