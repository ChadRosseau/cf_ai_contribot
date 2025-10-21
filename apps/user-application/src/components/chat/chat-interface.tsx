import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Check, X, Mic } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { authClient } from "@/lib/auth-client";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import { useDashboard } from "@/lib/dashboard-context";
// Type guard for tool invocation parts
// biome-ignore lint/suspicious/noExplicitAny: AI SDK types vary by version
function isToolInvocationUIPart(part: any): boolean {
	return (
		part &&
		typeof part === "object" &&
		typeof part.type === "string" &&
		part.type.startsWith("tool-")
	);
}

// List of tools that require human confirmation
const toolsRequiringConfirmation = [
	"forkRepository",
	"createBranch",
	"commentOnIssue",
	"createPullRequest",
];

export function ChatInterface() {
	const { data: session } = authClient.useSession();
	const { updateDashboardState, setAgentConnection } = useDashboard();
	const [input, setInput] = useState("");
	const [isConnected, setIsConnected] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	// biome-ignore lint/suspicious/noExplicitAny: PartySocket type from useAgent hook
	const lastConnectionRef = useRef<any>(null);
	// Track last processed state to prevent duplicate updates during streaming
	const lastProcessedStateRef = useRef<string>("");

	// Connect to the agent
	// Agent name is kebab-case of class name: ContribotAgent -> contribot-agent
	const connection = useAgent({
		agent: "contribot-agent",
		name: session?.user?.id || "",
		host: import.meta.env.DEV ? "localhost:8787" : undefined,
	});

	// Pass connection to dashboard context for state syncing
	// Only update when connection instance actually changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: setAgentConnection is stable, connection is the only real dependency
	useEffect(() => {
		if (!connection) return;

		// Only update if this is a different connection instance
		if (lastConnectionRef.current === connection) return;

		console.log("[ChatInterface] Setting agent connection");
		lastConnectionRef.current = connection;
		// biome-ignore lint/suspicious/noExplicitAny: PartySocket is compatible with WebSocket
		setAgentConnection(connection as any);

		return () => {
			console.log("[ChatInterface] Clearing agent connection");
			setAgentConnection(null);
			lastConnectionRef.current = null;
		};
	}, [connection]);

	// Track connection state changes with React state
	useEffect(() => {
		// Update state based on current readyState
		setIsConnected(connection?.readyState === 1);

		// Reset last processed state on connection change (reconnect)
		lastProcessedStateRef.current = "";

		// Listen for connection events to update state
		if (connection) {
			// biome-ignore lint/suspicious/noExplicitAny: PartySocket internal API
			const originalOnOpen = (connection as any).onopen;
			// biome-ignore lint/suspicious/noExplicitAny: PartySocket internal API
			const originalOnMessage = (connection as any).onmessage;
			// biome-ignore lint/suspicious/noExplicitAny: PartySocket internal API
			const originalOnError = (connection as any).onerror;
			// biome-ignore lint/suspicious/noExplicitAny: PartySocket internal API
			const originalOnClose = (connection as any).onclose;

			// biome-ignore lint/suspicious/noExplicitAny: WebSocket event types
			(connection as any).onopen = (event: any) => {
				setIsConnected(true);
				if (originalOnOpen) originalOnOpen.call(connection, event);
			};

			// biome-ignore lint/suspicious/noExplicitAny: WebSocket event types
			(connection as any).onmessage = (event: any) => {
				// Parse and handle agent state updates
				try {
					const data = JSON.parse(event.data);
					if (data.type === "cf_agent_state" && data.state?.dashboardState) {
						const dashState = data.state.dashboardState;

						// Deduplicate: only process if state has actually changed
						const currentStateString = JSON.stringify(dashState);
						if (currentStateString === lastProcessedStateRef.current) {
							// State hasn't changed, skip processing
							return;
						}

						console.log(
							"[Frontend] Received dashboard state update:",
							dashState,
						);

						// Update the last processed state
						lastProcessedStateRef.current = currentStateString;

						// Map agent state to context state
						// biome-ignore lint/suspicious/noExplicitAny: Agent state structure is dynamic
						const updates: any = {};

						// Navigation
						if (dashState.currentTab) {
							updates.activeTab = dashState.currentTab;
						}

						// Content
						if (dashState.issues) {
							updates.issues = dashState.issues;
						}
						if (dashState.repos) {
							updates.repos = dashState.repos;
						}
						if (dashState.selectedIssue !== undefined) {
							updates.selectedIssue = dashState.selectedIssue;
						}

						// Pagination
						if (dashState.issuesPage !== undefined) {
							updates.issuesPage = dashState.issuesPage;
						}
						if (dashState.reposPage !== undefined) {
							updates.reposPage = dashState.reposPage;
						}
						if (dashState.issuesTotalPages !== undefined) {
							updates.issuesTotalPages = dashState.issuesTotalPages;
						}
						if (dashState.reposTotalPages !== undefined) {
							updates.reposTotalPages = dashState.reposTotalPages;
						}

						// Filters (always set, even if empty object)
						if (dashState.issuesFilters !== undefined) {
							updates.issuesFilters = dashState.issuesFilters;
						}

						// Agent-specific metadata
						if (dashState.activeIssueId !== undefined) {
							updates.activeIssueId = dashState.activeIssueId;
						}
						if (dashState.activeRepoId !== undefined) {
							updates.activeRepoId = dashState.activeRepoId;
						}
						if (dashState.lastAction) {
							updates.lastAction = dashState.lastAction;
						}
						if (dashState.forkedRepoName) {
							updates.forkedRepoName = dashState.forkedRepoName;
						}
						if (dashState.branchName) {
							updates.branchName = dashState.branchName;
						}

						// skipSync=true: This update is FROM the agent, don't echo back
						updateDashboardState(updates, true);
					}
				} catch {
					// Not JSON or parsing error - that's okay
				}

				if (originalOnMessage) originalOnMessage.call(connection, event);
			};

			// biome-ignore lint/suspicious/noExplicitAny: WebSocket event types
			(connection as any).onerror = (event: any) => {
				setIsConnected(false);
				if (originalOnError) originalOnError.call(connection, event);
			};

			// biome-ignore lint/suspicious/noExplicitAny: WebSocket event types
			(connection as any).onclose = (event: any) => {
				setIsConnected(false);
				if (originalOnClose) originalOnClose.call(connection, event);
			};
		}
	}, [connection, updateDashboardState]);

	// Use the chat hook with the connected agent
	const { messages, addToolResult, clearHistory, status, sendMessage } =
		// biome-ignore lint/suspicious/noExplicitAny: AI SDK generic types vary by version
		useAgentChat<unknown, any>({
			agent: connection,
		});

	// Debug messages and status
	useEffect(() => {
		console.log("[Frontend] Messages updated:", messages);
		console.log("[Frontend] Status:", status);
	}, [messages, status]);

	// Auto-scroll to bottom when messages change
	// biome-ignore lint/correctness/useExhaustiveDependencies: messages changes should trigger scroll
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	useEffect(() => {
		setIsProcessing(status === "submitted" || status === "streaming");
	});

	const handleSendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || status === "submitted" || status === "streaming")
			return;

		const message = input;
		setInput("");

		await sendMessage({
			role: "user",
			parts: [{ type: "text", text: message }],
		});
	};

	// Check if any message has a pending tool confirmation
	const hasPendingConfirmation = messages.some(
		// biome-ignore lint/suspicious/noExplicitAny: AI SDK message types vary by version
		(m: any) =>
			m.parts?.some(
				// biome-ignore lint/suspicious/noExplicitAny: AI SDK part types vary by version
				(part: any) =>
					isToolInvocationUIPart(part) &&
					part.state === "input-available" &&
					toolsRequiringConfirmation.includes(part.type.replace("tool-", "")),
			),
	);

	return (
		<div className="flex flex-col h-full max-h-screen">
			<div className="p-4 pl-20 border-b">
				<h2 className="font-semibold">Contribot Assistant</h2>
				<p className="text-sm text-muted-foreground">
					{isConnected ? (
						<>
							<span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2" />
							Connected
						</>
					) : (
						<>
							<span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse" />
							Connecting...
						</>
					)}
				</p>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.length === 0 && (
					<div className="flex items-center justify-center h-full">
						<Card className="p-6 max-w-md">
							<div className="text-center space-y-4">
								<h3 className="font-semibold text-lg">Welcome to Contribot!</h3>
								<p className="text-sm text-muted-foreground">
									I can help you discover open source projects and contribute to
									them.
								</p>
								<div className="text-left space-y-2 text-sm">
									<p className="font-medium">Try asking:</p>
									<ul className="space-y-1 text-muted-foreground">
										<li>• "Show me TypeScript issues"</li>
										<li>• "Find beginner-friendly repos"</li>
										<li>• "What are my favorite repos?"</li>
										<li>• "Fork facebook/react"</li>
									</ul>
								</div>
							</div>
						</Card>
					</div>
				)}

				{/* biome-ignore lint/suspicious/noExplicitAny: AI SDK message types vary by version */}
				{messages.map((message: any) => {
					const isUser = message.role === "user";

					return (
						<div
							key={message.id}
							className={`flex ${isUser ? "justify-end" : "justify-start"}`}
						>
							<div className={`max-w-[85%] ${isUser ? "ml-auto" : "mr-auto"}`}>
								{/* Show message content if it exists (for messages without parts) */}
								{message.content &&
									typeof message.content === "string" &&
									!message.parts && (
										<Card
											key={message.id}
											className={`p-3 ${
												isUser
													? "bg-primary text-primary-foreground"
													: "bg-muted"
											}`}
										>
											<div className="text-sm prose prose-sm max-w-none dark:prose-invert">
												<ReactMarkdown>{message.content}</ReactMarkdown>
											</div>
										</Card>
									)}

								{message.parts?.map(
									// biome-ignore lint/suspicious/noExplicitAny: AI SDK part types vary by version
									(part: any, partIndex: any) => {
										// Text content - show if it's a text part with text property
										if (
											part.type === "text" &&
											part.text &&
											typeof part.text === "string"
										) {
											return (
												<Card
													key={`${message.id}-${partIndex}`}
													className={`p-3 ${
														isUser
															? "bg-primary text-primary-foreground"
															: "bg-muted"
													}`}
												>
													<div className="text-sm prose prose-sm max-w-none dark:prose-invert">
														<ReactMarkdown>{part.text}</ReactMarkdown>
													</div>
												</Card>
											);
										}

										// Skip step markers (internal execution flow)
										if (
											part.type === "step-start" ||
											part.type === "step-finish"
										) {
											return null;
										}

										// Tool invocation
										if (isToolInvocationUIPart(part)) {
											const toolName = part.type.replace("tool-", "");
											const needsConfirmation =
												toolsRequiringConfirmation.includes(toolName);

											// Auto-executing tool (no confirmation needed)
											// Show the message from the tool output if available
											if (!needsConfirmation) {
												// Safely extract message from output
												const outputMessage = part.output?.message;
												if (
													outputMessage &&
													typeof outputMessage === "string"
												) {
													return (
														<Card
															key={`${message.id}-${partIndex}`}
															className="p-3 bg-muted"
														>
															<div className="text-sm prose prose-sm max-w-none dark:prose-invert">
																<ReactMarkdown>{outputMessage}</ReactMarkdown>
															</div>
														</Card>
													);
												}
												// Otherwise hide it (executing or no message)
												return null;
											}

											// Tool requiring confirmation
											// Format a user-friendly description from tool input
											const formatToolDescription = (
												toolName: string,
												// biome-ignore lint/suspicious/noExplicitAny: Tool input structure is dynamic
												input: any,
											) => {
												if (toolName === "forkRepository") {
													return `Fork repository: ${input.owner}/${input.repo}`;
												}
												if (toolName === "createBranch") {
													return `Create branch "${input.branchName}" in ${input.owner}/${input.repo}`;
												}
												if (toolName === "commentOnIssue") {
													return `Comment on issue #${input.issueNumber} in ${input.owner}/${input.repo}`;
												}
												if (toolName === "createPullRequest") {
													return `Create PR: "${input.title}" from ${input.head} to ${input.base}`;
												}
												return `Execute ${toolName}`;
											};

											return (
												<Card
													key={`${message.id}-${partIndex}`}
													className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900"
												>
													<div className="space-y-3">
														<div className="font-medium text-sm">
															🔔 Confirmation Required
														</div>
														<div className="text-sm text-muted-foreground">
															{formatToolDescription(toolName, part.input)}
														</div>

														{part.state === "input-available" &&
															!part.output && (
																<div className="flex gap-2">
																	<Button
																		size="sm"
																		onClick={() => {
																			addToolResult({
																				tool: toolName,
																				toolCallId: part.toolCallId,
																				output: "yes",
																			});
																		}}
																		className="flex items-center gap-1"
																	>
																		<Check className="w-4 h-4" />
																		Approve
																	</Button>
																	<Button
																		size="sm"
																		variant="outline"
																		onClick={() => {
																			addToolResult({
																				tool: toolName,
																				toolCallId: part.toolCallId,
																				output: "no",
																			});
																		}}
																		className="flex items-center gap-1"
																	>
																		<X className="w-4 h-4" />
																		Deny
																	</Button>
																</div>
															)}

														{part.state === "output-available" && (
															<div className="text-sm">
																{part.output === "yes" ? (
																	<div className="flex items-center gap-2 text-green-600 dark:text-green-400">
																		<Check className="w-4 h-4" />
																		Approved - Executing...
																	</div>
																) : (
																	<div className="flex items-center gap-2 text-red-600 dark:text-red-400">
																		<X className="w-4 h-4" />
																		Denied
																	</div>
																)}
															</div>
														)}
													</div>
												</Card>
											);
										}

										return null;
									},
								)}
							</div>
						</div>
					);
				})}

				{isProcessing && (
					<div className="flex justify-start">
						<Card className="p-3 bg-muted">
							<div className="flex items-center gap-2">
								<Loader2 className="w-4 h-4 animate-spin" />
								<span className="text-sm">Thinking...</span>
							</div>
						</Card>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input Area */}
			<form onSubmit={handleSendMessage} className="p-4 border-t">
				<div className="flex items-center gap-2">
					<Input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder={
							hasPendingConfirmation
								? "Please respond to the confirmation above..."
								: isConnected
									? "Send a message..."
									: "Connecting..."
						}
						disabled={!isConnected || isProcessing || hasPendingConfirmation}
						className="flex-1"
					/>
					<Button
						type="submit"
						disabled={
							!input.trim() ||
							!isConnected ||
							isProcessing ||
							hasPendingConfirmation
						}
					>
						{isProcessing ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<Send className="w-4 h-4" />
						)}
					</Button>
					<Button type="button" variant="outline" disabled>
						<Mic className="w-4 h-4" />
					</Button>
				</div>
				<div className="flex items-center justify-between mt-2">
					<div className="text-xs text-muted-foreground">
						{messages.length} messages
					</div>
					{messages.length > 0 && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={clearHistory}
							className="text-xs"
						>
							Clear history
						</Button>
					)}
				</div>
			</form>
		</div>
	);
}
