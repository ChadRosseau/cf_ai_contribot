/**
 * AI Queue Processor - processes pending items in the AI summary queue
 * Called by orchestrator after scraping completes
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { AiSummarizer } from "./summarizer";
import {
	getPendingQueueItems,
	markQueueItemProcessing,
	completeQueueItem,
	failQueueItem,
	storeRepoSummary,
	storeIssueSummary,
	getQueueStats,
} from "@repo/data-ops/queries/ai-queue";
import { getRepoById } from "@repo/data-ops/queries/repos";
import { getIssueById } from "@repo/data-ops/queries/issues";

export interface AiQueueStats {
	processed: number;
	success: number;
	failed: number;
	remaining: number;
}

const BATCH_SIZE = 8; // Conservative for subrequest limits (8 * 6 = 48 subrequests)
const MAX_PROCESSING_TIME_MS = 60 * 60 * 1000; // 1 h

/**
 * Process a single batch of AI queue items (for workflow steps)
 * Returns stats and whether there are more items to process
 */
export async function processAiQueueBatch(
	db: DrizzleD1Database,
	ai: Ai,
	batchSize: number = BATCH_SIZE
): Promise<{ stats: AiQueueStats; hasMore: boolean }> {
	const summarizer = new AiSummarizer(ai);
	
	const stats: AiQueueStats = {
		processed: 0,
		success: 0,
		failed: 0,
		remaining: 0,
	};

	// Fetch next batch
	const queueItems = await getPendingQueueItems(db as any, batchSize);
	
	if (queueItems.length === 0) {
		console.log("AI queue is empty");
		return { stats, hasMore: false };
	}

	console.log(`Processing batch of ${queueItems.length} items...`);

	// Process each item
	for (const item of queueItems) {
		try {
			console.log(`  Processing ${item.entityType} ${item.entityId}...`);
			
			// Mark as processing
			await markQueueItemProcessing(db as any, item.id);

			// Process based on entity type
			if (item.entityType === "repo") {
				await processRepoSummary(db, summarizer, item);
			} else if (item.entityType === "issue") {
				await processIssueSummary(db, summarizer, item);
			} else {
				throw new Error(`Unknown entity type: ${item.entityType}`);
			}

			// Mark as completed
			await completeQueueItem(db as any, item.id);
			
			stats.processed++;
			stats.success++;
			console.log(`  ✓ Completed ${item.entityType} ${item.entityId}`);
		} catch (error) {
			console.error(`  ✗ Failed ${item.entityType} ${item.entityId}:`, error);
			
			const attempts = item.attempts + 1;
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			// Try to mark as failed, but don't let this failure stop processing
			try {
				await failQueueItem(db as any, item.id, errorMessage, attempts);
			} catch (failError) {
				console.error(`  ✗✗ Could not mark item as failed:`, failError);
			}
			
			stats.processed++;
			stats.failed++;
			
			// Continue to next item regardless of error
			continue;
		}
	}

	// Check if there are more items
	const remainingItems = await getPendingQueueItems(db as any, 1);
	const hasMore = remainingItems.length > 0;

	// Get remaining queue count
	try {
		const queueStatsResult = await getQueueStats(db as any);
		const pendingCount = queueStatsResult.find((s: { status: string; count: number }) => s.status === "pending");
		stats.remaining = pendingCount ? pendingCount.count : 0;
	} catch (error) {
		console.error("Failed to get queue stats:", error);
		stats.remaining = -1;
	}

	console.log("Batch processing complete:", stats);
	return { stats, hasMore };
}

export async function processAiQueue(
	db: DrizzleD1Database,
	ai: Ai
): Promise<AiQueueStats> {
	const summarizer = new AiSummarizer(ai);
	const startTime = Date.now();
	
	const stats: AiQueueStats = {
		processed: 0,
		success: 0,
		failed: 0,
		remaining: 0,
	};

	console.log("Processing AI queue...");

	while (true) {
		// Check timeout
		if (Date.now() - startTime > MAX_PROCESSING_TIME_MS) {
			console.log("AI queue processing timeout reached (1 hour)");
			break;
		}

		// Fetch next batch
		const queueItems = await getPendingQueueItems(db as any, BATCH_SIZE);
		
		if (queueItems.length === 0) {
			console.log("AI queue is empty");
			break;
		}

		console.log(`Processing batch of ${queueItems.length} items...`);

		// Process each item
		for (const item of queueItems) {
			try {
				console.log(`  Processing ${item.entityType} ${item.entityId}...`);
				
				// Mark as processing
				await markQueueItemProcessing(db as any, item.id);

				// Process based on entity type
				if (item.entityType === "repo") {
					await processRepoSummary(db, summarizer, item);
				} else if (item.entityType === "issue") {
					await processIssueSummary(db, summarizer, item);
				} else {
					throw new Error(`Unknown entity type: ${item.entityType}`);
				}

				// Mark as completed
				await completeQueueItem(db as any, item.id);
				
				stats.processed++;
				stats.success++;
				console.log(`  ✓ Completed ${item.entityType} ${item.entityId}`);
			} catch (error) {
				console.error(`  ✗ Failed ${item.entityType} ${item.entityId}:`, error);
				
				const attempts = item.attempts + 1;
				const errorMessage = error instanceof Error ? error.message : String(error);
				
				// Try to mark as failed, but don't let this failure stop processing
				try {
					await failQueueItem(db as any, item.id, errorMessage, attempts);
				} catch (failError) {
					console.error(`  ✗✗ Could not mark item as failed:`, failError);
				}
				
				stats.processed++;
				stats.failed++;
				
				// Continue to next item regardless of error
				continue;
			}
		}
	}

	// Get remaining queue count
	try {
		const queueStatsResult = await getQueueStats(db as any);
		const pendingCount = queueStatsResult.find((s: { status: string; count: number }) => s.status === "pending");
		stats.remaining = pendingCount ? pendingCount.count : 0;
	} catch (error) {
		console.error("Failed to get queue stats:", error);
		stats.remaining = -1; // Indicate error
	}

	console.log("AI queue processing complete:", stats);
	return stats;
}

async function processRepoSummary(
	db: DrizzleD1Database,
	summarizer: AiSummarizer,
	queueItem: { id: number; entityType: string; entityId: number }
) {
	// Fetch repo data
	const repo = await getRepoById(db as any, queueItem.entityId);
	if (!repo) {
		throw new Error(`Repo ${queueItem.entityId} not found`);
	}

	// Generate summary
	const result = await summarizer.summarizeRepo(
		repo.owner,
		repo.name,
		repo.languagesOrdered as string[]
	);

	// Store summary
	await storeRepoSummary(db as any, repo.id, result.summary);
}

async function processIssueSummary(
	db: DrizzleD1Database,
	summarizer: AiSummarizer,
	queueItem: { id: number; entityType: string; entityId: number }
) {
	// Fetch issue data
	const issue = await getIssueById(db as any, queueItem.entityId);
	if (!issue) {
		throw new Error(`Issue ${queueItem.entityId} not found`);
	}

	// Get repo data for context
	const repo = await getRepoById(db as any, issue.repoId);
	if (!repo) {
		throw new Error(`Repo ${issue.repoId} not found`);
	}

	// Generate analysis
	const result = await summarizer.analyzeIssue(
		repo.owner,
		repo.name,
		issue.title,
		issue.body
	);

	// Store summary
	await storeIssueSummary(db as any, issue.id, {
		issueIntro: result.intro,
		difficultyScore: result.difficulty,
		firstSteps: result.firstSteps,
	});
}

