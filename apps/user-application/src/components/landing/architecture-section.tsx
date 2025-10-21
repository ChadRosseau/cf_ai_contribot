import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Zap, Globe, Brain, ArrowRight } from "lucide-react";

export function ArchitectureSection() {
	return (
		<section className="py-24 sm:py-32 relative overflow-hidden">
			{/* Background */}
			<div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-muted/20 to-background" />

			<div className="mx-auto max-w-7xl px-6 lg:px-8">
				{/* Section Header */}
				<div className="mx-auto max-w-2xl text-center mb-16">
					<h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl mb-4">
						Powered by the
						<span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-[#FF6633]">
							{" "}
							edge
						</span>
					</h2>
					<p className="text-lg text-muted-foreground">
						A simple architecture designed for speed and reliability
					</p>
				</div>

				{/* Simplified Architecture Diagram */}
				<div className="max-w-4xl mx-auto mb-16">
					<div className="grid gap-8 lg:grid-cols-5">
						{/* Column 1: Data Collection */}
						<div className="space-y-4">
							<div className="text-center mb-6">
								<div className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-gradient-to-br from-primary/20 to-[#FF6633]/20 mb-3">
									<Database className="h-10 w-10 text-primary" />
								</div>
								<h3 className="text-xl font-semibold">Collect</h3>
								<p className="text-sm text-muted-foreground">
									Automated discovery
								</p>
							</div>
						</div>

						{/* Arrow */}
						<div className="hidden lg:flex items-center justify-center">
							<div className="flex flex-col items-center gap-4">
								<ArrowRight className="h-8 w-8 text-primary" />
							</div>
						</div>

						{/* Column 2: AI Processing */}
						<div className="space-y-4">
							<div className="text-center mb-6">
								<div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-[#FF6633]/20 mb-3">
									<Brain className="h-6 w-6 text-primary" />
								</div>
								<h3 className="text-xl font-semibold">Analyze</h3>
								<p className="text-sm text-muted-foreground">
									AI-powered insights
								</p>
							</div>
						</div>

						{/* Arrow */}
						<div className="hidden lg:flex items-center justify-center">
							<div className="flex flex-col items-center gap-4">
								<ArrowRight className="h-8 w-8 text-primary" />
							</div>
						</div>

						{/* Column 3: User Experience */}
						<div className="space-y-4">
							<div className="text-center mb-6">
								<div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-[#FF6633]/20 mb-3">
									<Zap className="h-6 w-6 text-primary" />
								</div>
								<h3 className="text-xl font-semibold">Deliver</h3>
								<p className="text-sm text-muted-foreground">Instant access</p>
							</div>
						</div>
					</div>
				</div>

				{/* Tech Stack Highlights */}
				<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
					<Card className="text-center hover:shadow-lg transition-all duration-300 bg-card/50">
						<CardContent className="p-6">
							<Globe className="h-8 w-8 text-primary mx-auto mb-3" />
							<h4 className="font-semibold mb-2">Edge Network</h4>
							<p className="text-sm text-muted-foreground">
								Cloudflare Workers & Pages
							</p>
						</CardContent>
					</Card>
					<Card className="text-center hover:shadow-lg transition-all duration-300 bg-card/50">
						<CardContent className="p-6">
							<Database className="h-8 w-8 text-primary mx-auto mb-3" />
							<h4 className="font-semibold mb-2">D1 Database</h4>
							<p className="text-sm text-muted-foreground">
								Edge-replicated SQLite
							</p>
						</CardContent>
					</Card>
					<Card className="text-center hover:shadow-lg transition-all duration-300 bg-card/50">
						<CardContent className="p-6">
							<Brain className="h-8 w-8 text-primary mx-auto mb-3" />
							<h4 className="font-semibold mb-2">AI Models</h4>
							<p className="text-sm text-muted-foreground">
								OpenAI & Llama 3.3 70B
							</p>
						</CardContent>
					</Card>
					<Card className="text-center hover:shadow-lg transition-all duration-300 bg-card/50">
						<CardContent className="p-6">
							<Zap className="h-8 w-8 text-primary mx-auto mb-3" />
							<h4 className="font-semibold mb-2">Durable Objects</h4>
							<p className="text-sm text-muted-foreground">
								Stateful AI agents
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</section>
	);
}
