import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    suggestedActions?: Array<{ action: string; label: string }>;
}

export function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content:
                "Hi! I'm Contribot, your AI guide to open source contributions. I can help you find beginner-friendly issues, fork repositories, create branches, and submit your first pull request. What would you like to work on today?",
            timestamp: Date.now(),
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const initializeAgent = async () => {
            try {
                await fetch("/api/agent/initialize", {
                    method: "POST",
                });
                setInitialized(true);
            } catch (error) {
                console.error("Failed to initialize agent:", error);
            }
        };

        initializeAgent();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    const handleSendMessage = async () => {
        if (!input.trim() || loading || !initialized) return;

        const userMessage: Message = {
            role: "user",
            content: input,
            timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        try {
            const response = await fetch("/api/agent/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: input }),
            });

            const data = (await response.json()) as {
                response: string;
                suggestedActions?: Array<{ action: string; label: string }>;
            };

            const assistantMessage: Message = {
                role: "assistant",
                content: data.response,
                timestamp: Date.now(),
                suggestedActions: data.suggestedActions,
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Failed to send message:", error);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "Sorry, I encountered an error. Please try again.",
                    timestamp: Date.now(),
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: string) => {
        setInput(`I want to ${action}`);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 pl-20 border-b">
                <h2 className="font-semibold">Contribot Assistant</h2>
                <p className="text-sm text-muted-foreground">
                    {initialized ? "Ready to help" : "Initializing..."}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                    <div
                        key={`${message.timestamp}-${index}`}
                        className={`flex ${
                            message.role === "user"
                                ? "justify-end"
                                : "justify-start"
                        }`}
                    >
                        <Card
                            className={`max-w-[80%] p-4 ${
                                message.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                            }`}
                        >
                            <div className="text-sm prose prose-sm max-w-none">
                                <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>
                            {message.suggestedActions &&
                                message.suggestedActions.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {message.suggestedActions.map(
                                            (action, idx) => (
                                                <Button
                                                    key={`${action.action}-${idx}`}
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleAction(
                                                            action.action
                                                        )
                                                    }
                                                >
                                                    {action.label}
                                                </Button>
                                            )
                                        )}
                                    </div>
                                )}
                        </Card>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <Card className="max-w-[80%] p-4 bg-muted">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </Card>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="border-t p-4">
                <div className="flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === "Enter" && handleSendMessage()
                        }
                        placeholder="Ask me anything about contributing..."
                        disabled={loading || !initialized}
                    />
                    <Button
                        onClick={handleSendMessage}
                        disabled={loading || !initialized || !input.trim()}
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
