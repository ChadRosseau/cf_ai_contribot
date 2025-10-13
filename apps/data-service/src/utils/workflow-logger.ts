/**
 * Workflow Logger - Captures console output and writes to R2
 */

import { R2Logger, type LogEntry } from "./r2-logger";

export class WorkflowLogger {
	private r2Logger: R2Logger;
	private currentStep: string | null = null;
	private stepStartTime: number | null = null;
	private originalConsole: {
		log: typeof console.log;
		error: typeof console.error;
		warn: typeof console.warn;
	};

	constructor(r2Logger: R2Logger) {
		this.r2Logger = r2Logger;

		// Store original console methods
		this.originalConsole = {
			log: console.log.bind(console),
			error: console.error.bind(console),
			warn: console.warn.bind(console),
		};
	}

	/**
	 * Start capturing console output
	 */
	startCapture(): void {
		const self = this;

		// Intercept console.log
		console.log = (...args: unknown[]) => {
			self.originalConsole.log(...args);
			self.captureLog("info", args);
		};

		// Intercept console.error
		console.error = (...args: unknown[]) => {
			self.originalConsole.error(...args);
			self.captureLog("error", args);
		};

		// Intercept console.warn
		console.warn = (...args: unknown[]) => {
			self.originalConsole.warn(...args);
			self.captureLog("warn", args);
		};
	}

	/**
	 * Stop capturing console output
	 */
	stopCapture(): void {
		console.log = this.originalConsole.log;
		console.error = this.originalConsole.error;
		console.warn = this.originalConsole.warn;
	}

	/**
	 * Capture a console call
	 */
	private captureLog(level: "info" | "warn" | "error", args: unknown[]): void {
		const message = args
			.map((arg) => {
				if (typeof arg === "string") return arg;
				if (arg instanceof Error) return arg.message;
				try {
					return JSON.stringify(arg);
				} catch {
					return String(arg);
				}
			})
			.join(" ");

		const entry: Omit<LogEntry, "timestamp"> = {
			level,
			message,
			step: this.currentStep || undefined,
		};

		// Include error stacks
		if (level === "error") {
			const errorArg = args.find((arg) => arg instanceof Error);
			if (errorArg instanceof Error) {
				entry.stack = errorArg.stack;
			}
		}

		this.r2Logger.log(entry);
	}

	/**
	 * Start a new workflow step
	 */
	startStep(stepName: string): void {
		this.currentStep = stepName;
		this.stepStartTime = Date.now();

		this.r2Logger.log({
			level: "info",
			step: stepName,
			message: `[STEP START] ${stepName}`,
		});
	}

	/**
	 * End the current workflow step
	 */
	endStep(stepName: string, result?: unknown): void {
		const duration = this.stepStartTime ? Date.now() - this.stepStartTime : undefined;

		this.r2Logger.log({
			level: "info",
			step: stepName,
			message: `[STEP END] ${stepName}`,
			duration,
			data: result,
		});

		this.currentStep = null;
		this.stepStartTime = null;
	}

	/**
	 * Log a step error
	 */
	stepError(stepName: string, error: unknown): void {
		const duration = this.stepStartTime ? Date.now() - this.stepStartTime : undefined;

		this.r2Logger.log({
			level: "error",
			step: stepName,
			message: `[STEP ERROR] ${stepName}: ${error instanceof Error ? error.message : String(error)}`,
			duration,
			stack: error instanceof Error ? error.stack : undefined,
		});

		this.currentStep = null;
		this.stepStartTime = null;
	}

	/**
	 * Flush logs to R2 and clear buffer
	 */
	async flush(): Promise<void> {
		await this.r2Logger.flush();
		this.r2Logger.clear();
	}

	/**
	 * Flush logs without clearing buffer (for intermediate writes)
	 */
	async flushKeep(): Promise<void> {
		await this.r2Logger.flush();
	}
}

