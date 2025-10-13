/**
 * R2 Logger - Writes workflow logs to Cloudflare R2
 */

export interface LogEntry {
	timestamp: string;
	level: "info" | "warn" | "error";
	step?: string;
	message: string;
	data?: unknown;
	duration?: number;
	stack?: string;
}

export class R2Logger {
	private bucket: R2Bucket | null;
	private enabled: boolean;
	private runId: string;
	private logs: LogEntry[] = [];
	private currentStep: string = "init";

	constructor(bucket: R2Bucket | null | undefined, enabled: boolean, runId: string) {
		this.bucket = bucket || null;
		this.enabled = enabled && this.bucket !== null;
		this.runId = runId;
	}

	/**
	 * Set the current step name for file naming
	 */
	setCurrentStep(stepName: string): void {
		this.currentStep = stepName;
	}

	/**
	 * Add a log entry to the buffer
	 */
	log(entry: Omit<LogEntry, "timestamp">): void {
		if (!this.enabled) return;

		const logEntry: LogEntry = {
			timestamp: new Date().toISOString(),
			...entry,
		};

		this.logs.push(logEntry);
	}

	/**
	 * Write buffered logs to R2
	 */
	async flush(): Promise<void> {
		if (!this.enabled || !this.bucket || this.logs.length === 0) {
			return;
		}

		try {
			const now = new Date();
			const year = now.getUTCFullYear();
			const month = String(now.getUTCMonth() + 1).padStart(2, "0");
			const day = String(now.getUTCDate()).padStart(2, "0");
			const timestamp = now.getTime();

			// File path: logs/YYYY/MM/DD/run-{instanceId}-{timestamp}.jsonl
			const key = `logs/${year}/${month}/${day}/run-${this.runId}-${timestamp}.jsonl`;

			// Convert logs to JSONL format
			const jsonl = this.logs.map((log) => JSON.stringify(log)).join("\n");

			// Write to R2
			await this.bucket.put(key, jsonl, {
				httpMetadata: {
					contentType: "application/x-ndjson",
				},
			});

			console.log(`✓ Wrote ${this.logs.length} log entries to R2: ${key}`);
		} catch (error) {
			// Silently fail - don't break workflow if R2 fails
			console.error("Failed to write logs to R2 (non-fatal):", error);
		}
	}

	/**
	 * Get the number of buffered logs
	 */
	getLogCount(): number {
		return this.logs.length;
	}

	/**
	 * Clear the log buffer (after successful write)
	 */
	clear(): void {
		this.logs = [];
	}
}

