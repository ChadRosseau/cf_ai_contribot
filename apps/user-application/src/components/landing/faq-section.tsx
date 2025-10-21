import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
	{
		question: "Do I need to be an experienced developer?",
		answer:
			"Not at all! Contribot is specifically designed for beginners making their first open source contributions. The AI agent provides guidance at every step, from understanding issues to submitting pull requests. We match you with issues appropriate for your skill level.",
	},
	{
		question: "Is Contribot really free?",
		answer:
			"Yes, completely free! Contribot is an open source project built on Cloudflare's edge platform. There are no hidden costs, subscription fees, or premium tiers. We believe everyone should have access to tools that help them start contributing to open source.",
	},
	{
		question: "What programming languages are supported?",
		answer:
			"Contribot supports issues across all major programming languages. During onboarding, you can select your preferred languages (like JavaScript, TypeScript, Python, Rust, Go, etc.), and we'll match you with relevant issues. You can also scan your GitHub profile to auto-detect your experience.",
	},
	{
		question: "How does the AI agent work?",
		answer:
			"The AI agent uses OpenAI's models for conversational interactions, while repository and issue analysis is powered by Llama 3.3 70B on Workers AI. It maintains conversation context, remembers your preferences, and can execute GitHub actions with your permission. Each user gets their own stateful agent that persists across sessions.",
	},
	{
		question: "Can the agent make changes to my GitHub account?",
		answer:
			"Only with your explicit confirmation. Every write operation (forking repos, creating branches, commenting on issues, opening PRs) requires your approval first. The agent will show you exactly what it will do before taking any action. You're always in control.",
	},
	{
		question: "How often is the issue database updated?",
		answer:
			"Our scraper service runs twice daily to discover new repositories and issues. We use smart change detection to only process repositories with meaningful updates, ensuring you always see fresh opportunities while minimizing unnecessary work.",
	},
	{
		question: "What if I get stuck on an issue?",
		answer:
			"That's what the AI agent is for! You can ask it questions about the codebase, get clarification on requirements, or request suggestions for your approach. The agent has context about the issue and can guide you through common challenges. You can also reach out to the repository maintainers directly.",
	},
	{
		question: "Can I use Contribot for experienced contributor workflows?",
		answer:
			"While Contribot is optimized for beginners, experienced developers can benefit from the AI-powered discovery and the conversational interface for GitHub actions. However, the issue recommendations are specifically curated for those making their first contributions.",
	},
	{
		question: "How do I get started?",
		answer:
			'Simply click "Start with GitHub" to sign in with your GitHub account. You\'ll go through a quick 60-second onboarding to set your language preferences and skill level. Then you can immediately start chatting with the AI agent to discover issues and begin contributing!',
	},
];

export function FaqSection() {
	const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

	const toggleItem = (question: string) => {
		setOpenItems((prev) => ({
			...prev,
			[question]: !prev[question],
		}));
	};

	return (
		<section className="py-24 sm:py-32 bg-muted/30">
			<div className="mx-auto max-w-4xl px-6 lg:px-8">
				{/* Section Header */}
				<div className="text-center mb-16">
					<h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl mb-4">
						Common
						<span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-[#FF6633]">
							{" "}
							questions
						</span>
					</h2>
					<p className="text-lg text-muted-foreground">
						Everything you need to know about getting started
					</p>
				</div>

				{/* FAQ List */}
				<div className="space-y-4">
					{faqs.map((faq) => (
						<Card
							key={faq.question}
							className="overflow-hidden hover:shadow-lg transition-shadow"
						>
							<Collapsible
								open={openItems[faq.question]}
								onOpenChange={() => toggleItem(faq.question)}
							>
								<CollapsibleTrigger className="w-full">
									<CardContent className="p-6 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors">
										<h3 className="text-lg font-semibold text-left">
											{faq.question}
										</h3>
										<ChevronDown
											className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform ${
												openItems[faq.question] ? "transform rotate-180" : ""
											}`}
										/>
									</CardContent>
								</CollapsibleTrigger>
								<CollapsibleContent>
									<CardContent className="px-6 pb-6 pt-0">
										<p className="text-muted-foreground leading-relaxed">
											{faq.answer}
										</p>
									</CardContent>
								</CollapsibleContent>
							</Collapsible>
						</Card>
					))}
				</div>
			</div>
		</section>
	);
}
