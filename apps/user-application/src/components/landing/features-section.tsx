import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	MessageSquare,
	Search,
	GitBranch,
	Zap,
	Target,
	Brain,
	Heart,
	Clock,
	Shield,
} from "lucide-react";

const mainFeatures = [
	{
		icon: Search,
		title: "Intelligent Discovery",
		description:
			"Automated repository scanning finds beginner-friendly projects. Continuous tracking keeps issue data fresh with twice-daily updates.",
		highlights: [
			"Curated repository sources",
			"Real-time issue tracking",
			"Smart change detection",
		],
	},
	{
		icon: Brain,
		title: "AI-Powered Analysis",
		description:
			"Get one-paragraph repository summaries, concise issue explanations, and automated difficulty scoring from 1-5 to match your skill level.",
		highlights: [
			"Repository overviews",
			"Issue context & first steps",
			"Difficulty assessment",
		],
	},
	{
		icon: MessageSquare,
		title: "Conversational Interface",
		description:
			"Real-time chat with sub-50ms latency. Your personal AI agent remembers context and guides you through every step of contributing.",
		highlights: [
			"WebSocket-based chat",
			"Stateful conversation",
			"Natural language actions",
		],
	},
	{
		icon: Target,
		title: "Personalized Experience",
		description:
			"Filter by programming language, match issues to your skill level, and scan your GitHub profile to auto-detect your experience.",
		highlights: [
			"Language preferences",
			"Difficulty matching",
			"Quick onboarding",
		],
	},
	{
		icon: GitBranch,
		title: "GitHub Actions",
		description:
			"Fork repositories, create branches, comment on issues, and submit pull requests—all through chat or with one-click buttons.",
		highlights: [
			"Repository forking",
			"Automated branch setup",
			"PR creation workflow",
		],
	},
	{
		icon: Zap,
		title: "Edge-Powered Performance",
		description:
			"Built on Cloudflare's global network for lightning-fast responses. Stateful AI agents run on Durable Objects for reliable, scalable performance.",
		highlights: [
			"Global edge deployment",
			"Sub-50ms latency",
			"Automatic scaling",
		],
	},
];

const additionalFeatures = [
	{
		icon: Zap,
		title: "Lightning Fast",
		description:
			"Sub-50ms response times powered by Cloudflare's global edge network",
	},
	{
		icon: Clock,
		title: "Always Fresh",
		description:
			"Issue database updated twice daily to show the latest opportunities",
	},
	{
		icon: Shield,
		title: "Safe & Secure",
		description: "Confirmation required for all write operations—no surprises",
	},
	{
		icon: Heart,
		title: "Beginner Friendly",
		description:
			"Built specifically for developers making their first contributions",
	},
];

export function FeaturesSection() {
	return (
		// eslint-disable-next-line react/no-unknown-property
		<section id="features" className="py-24 sm:py-32 bg-muted/30">
			<div className="mx-auto max-w-7xl px-6 lg:px-8">
				{/* Section Header */}
				<div className="mx-auto max-w-2xl text-center mb-16">
					<h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl mb-4">
						Everything you need to<br></br>
						<span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-[#FF6633]">
							{" "}
							start contributing
						</span>
					</h2>
					<p className="text-lg text-muted-foreground">
						Powered by AI and built on Cloudflare's edge platform
					</p>
				</div>

				{/* Main Features Grid */}
				<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-16">
					{mainFeatures.map((feature, index) => {
						const IconComponent = feature.icon;
						return (
							<Card
								key={feature.title}
								className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-primary/10 hover:border-primary/30"
								style={{
									animationDelay: `${index * 100}ms`,
								}}
							>
								<CardHeader>
									<div className="flex items-start justify-between mb-3">
										<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 group-hover:from-primary/30 group-hover:to-accent/30 transition-all">
											<IconComponent className="h-6 w-6 text-primary" />
										</div>
									</div>
									<CardTitle className="text-xl">{feature.title}</CardTitle>
								</CardHeader>
								<CardContent>
									<CardDescription className="text-sm leading-relaxed mb-4">
										{feature.description}
									</CardDescription>
									<ul className="space-y-2">
										{feature.highlights.map((highlight) => (
											<li
												key={highlight}
												className="text-xs text-muted-foreground flex items-center gap-2"
											>
												<div className="h-1.5 w-1.5 rounded-full bg-primary" />
												{highlight}
											</li>
										))}
									</ul>
								</CardContent>
							</Card>
						);
					})}
				</div>

				{/* Additional Features */}
				<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
					{additionalFeatures.map((feature) => {
						const IconComponent = feature.icon;
						return (
							<Card
								key={feature.title}
								className="text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-card/50"
							>
								<CardHeader>
									<div className="flex justify-center mb-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
											<IconComponent className="h-5 w-5 text-primary" />
										</div>
									</div>
									<CardTitle className="text-base">{feature.title}</CardTitle>
								</CardHeader>
								<CardContent>
									<CardDescription className="text-sm">
										{feature.description}
									</CardDescription>
								</CardContent>
							</Card>
						);
					})}
				</div>
			</div>
		</section>
	);
}
