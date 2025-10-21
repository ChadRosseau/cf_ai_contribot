import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Search,
	MessageSquare,
	GitFork,
	Code2,
	GitPullRequest,
	CheckCircle2,
} from "lucide-react";

const steps = [
	{
		number: "01",
		icon: Search,
		title: "Discover Issues",
		description:
			"Start by chatting with the AI agent or browsing the dashboard. Tell us your interests and skill level, and we'll suggest beginner-friendly issues that match.",
		example: '"Show me some TypeScript issues for beginners"',
	},
	{
		number: "02",
		icon: MessageSquare,
		title: "Get AI Guidance",
		description:
			"Ask the AI agent to explain any issue. Get context about the codebase, understand what needs to be fixed, and receive personalized recommendations for your skill level.",
		example: '"Tell me more about this React issue"',
	},
	{
		number: "03",
		icon: GitFork,
		title: "Set Up Your Workspace",
		description:
			"Request GitHub actions through natural conversation. The agent will fork the repository and create a branch for you—all with your confirmation.",
		example: '"Fork this repo and create a branch for me"',
	},
	{
		number: "04",
		icon: Code2,
		title: "Make Your Changes",
		description:
			"Clone the repository locally and work on your contribution. The agent is always available to answer questions about the codebase or best practices.",
		example: '"How should I structure this component?"',
	},
	{
		number: "05",
		icon: GitPullRequest,
		title: "Submit Your PR",
		description:
			"Once you've pushed your changes, use the agent to draft comments and create a pull request. Get help following the repository's contribution guidelines.",
		example: '"Help me create a PR for my changes"',
	},
	{
		number: "06",
		icon: CheckCircle2,
		title: "Track Progress",
		description:
			"Monitor your contributions through the dashboard. Favorite issues and repos to track them, and return anytime—the agent remembers your conversation context.",
		example: "View stats and manage your favorites",
	},
];

export function HowItWorksSection() {
	return (
		<section className="py-24 sm:py-32 relative overflow-hidden">
			{/* Background decoration */}
			<div className="absolute inset-0 -z-10">
				<div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full filter blur-3xl" />
				<div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full filter blur-3xl" />
			</div>

			<div className="mx-auto max-w-7xl px-6 lg:px-8">
				{/* Section Header */}
				<div className="mx-auto max-w-2xl text-center mb-16">
					<h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl mb-4">
						From discovery to your first
						<span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-[#FF6633]">
							{" "}
							pull request
						</span>
					</h2>
					<p className="text-lg text-muted-foreground">
						A guided journey with AI assistance at every step
					</p>
				</div>

				{/* Steps Timeline */}
				<div className="relative">
					{/* Connecting line (hidden on mobile) */}
					<div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#FF6633] to-primary -translate-x-1/2" />
					<div className="hidden lg:block absolute left-1/2 top-0 w-2 h-2 bg-[#FF6633] -translate-x-1/2 rounded-full" />
					<div className="hidden lg:block absolute left-1/2 bottom-0 w-2 h-2 bg-primary -translate-x-1/2 rounded-full" />

					{/* Steps */}
					<div className="space-y-12">
						{steps.map((step, index) => {
							const IconComponent = step.icon;
							const isEven = index % 2 === 0;

							return (
								<div
									key={step.number}
									className={`relative flex items-center ${
										isEven ? "lg:flex-row" : "lg:flex-row-reverse"
									}`}
								>
									{/* Step number badge (center on desktop) */}
									<div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 z-10">
										<div className="flex items-center justify-center w-16 h-16 rounded-full bg-background border-4 border-primary/50">
											<span className="text-2xl font-bold text-primary">
												{step.number}
											</span>
										</div>
									</div>

									{/* Content card */}
									<div
										className={`w-full lg:w-[calc(50%-4rem)] ${
											isEven ? "lg:pr-16" : "lg:pl-16"
										}`}
									>
										<Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-primary/20">
											<CardContent className="p-6">
												<div className="flex items-start gap-4">
													{/* Mobile number badge */}
													<div className="lg:hidden flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/30">
														<span className="text-lg font-bold text-primary">
															{step.number}
														</span>
													</div>

													{/* Icon */}
													<div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
														<IconComponent className="h-6 w-6 text-primary" />
													</div>

													{/* Text content */}
													<div className="flex-1 min-w-0">
														<h3 className="text-xl font-semibold mb-2">
															{step.title}
														</h3>
														<p className="text-sm text-muted-foreground mb-3">
															{step.description}
														</p>
														<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-xs font-mono text-muted-foreground">
															{step.example}
														</div>
													</div>
												</div>
											</CardContent>
										</Card>
									</div>

									{/* Spacer for other side on desktop */}
									<div className="hidden lg:block w-[calc(50%-4rem)]" />
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
}
