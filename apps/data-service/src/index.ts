import { WorkerEntrypoint } from "cloudflare:workers";
import { app } from "@/hono/app";
import { ScraperWorkflow } from "@/workflows/scraper-workflow";

// Export the workflow for Cloudflare to register it
export { ScraperWorkflow };

// Main worker class
export default class DataService extends WorkerEntrypoint<Env> {
  async fetch(request: Request) {
    // Handle the special scheduled trigger endpoint for testing
    const url = new URL(request.url);
    
    if (url.pathname === "/cdn-cgi/handler/scheduled" && request.method === "GET") {
      console.log("Manual scheduled trigger received");
      
      // Create a mock controller for testing
      const controller = {
        scheduledTime: Date.now(),
        cron: "manual-trigger",
      } as ScheduledController;
      
      // Call the scheduled handler
      await this.scheduled(controller, this.env, this.ctx);
      
      return new Response(JSON.stringify({
        success: true,
        message: "Scheduled handler triggered",
        time: new Date().toISOString(),
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Pass all other requests to Hono
    return app.fetch(request, this.env, this.ctx);
  }

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log("=== Cron triggered ===");
    console.log("Time:", new Date().toISOString());
    console.log("Cron pattern:", controller.cron);
    
    try {
      // Check if workflow binding is available
      if (!env.SCRAPER_WORKFLOW) {
        console.error("❌ SCRAPER_WORKFLOW binding not available");
        console.error("Make sure you're running with: wrangler dev --remote");
        console.error("Or the workflow is properly configured in wrangler.jsonc");
        return;
      }

      console.log("Starting scraper workflow...");
      const instance = await env.SCRAPER_WORKFLOW.create({
        params: {
          triggeredAt: new Date().toISOString(),
        },
      });
      
      console.log(`✓ Workflow instance created: ${instance.id}`);
    } catch (error) {
      console.error("❌ Failed to start workflow:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
        console.error("Stack:", error.stack);
      }
    }
  }
}
