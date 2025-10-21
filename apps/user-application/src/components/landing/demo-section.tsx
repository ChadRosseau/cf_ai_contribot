import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function DemoSection() {
	return (
		<section className="py-24 sm:py-32 bg-muted/30">
			<div className="mx-auto max-w-7xl px-6 lg:px-8">
				{/* Section Header */}
				<div className="mx-auto max-w-2xl text-center mb-16">
					<h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl mb-4">
						A split-view interface built for
						<span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-[#FF6633]">
							{" "}
							productivity
						</span>
					</h2>
					<p className="text-lg text-muted-foreground">
						Chat on the left, explore on the right—everything you need in one
						view
					</p>
				</div>

				{/* Demo Tabs */}
				<Tabs defaultValue="onboarding" className="w-4/5 mx-auto">
					<TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
						<TabsTrigger value="onboarding">Onboarding</TabsTrigger>
						<TabsTrigger value="app">Dashboard</TabsTrigger>
					</TabsList>

					<TabsContent value="onboarding" className="mt-0">
						<Card className="overflow-hidden border-2 border-primary/20 p-2">
							<div className="aspect-video bg-muted/50 flex items-center justify-center">
								{/* Placeholder for screenshot */}
								<img
									src="/screenshots/onboarding.png"
									alt="Contribot Onboarding Flow"
									className="object-contain rounded-xl"
									onError={(e) => {
										e.currentTarget.style.display = "none";
										const parent = e.currentTarget.parentElement;
										if (parent) {
											const placeholder = document.createElement("div");
											placeholder.className =
												"flex flex-col items-center justify-center gap-4 p-8";
											placeholder.innerHTML = `
												<div class="text-6xl">🚀</div>
												<p class="text-lg font-medium text-muted-foreground">Quick Onboarding</p>
												<p class="text-sm text-muted-foreground max-w-md text-center">
													Set your language preferences and skill level in under 60 seconds. Connect your GitHub account and you're ready to start contributing.
												</p>
											`;
											parent.appendChild(placeholder);
										}
									}}
								/>
							</div>
						</Card>
						<p className="text-center text-sm text-muted-foreground mt-4">
							Quick 60-second setup to personalize your experience
						</p>
					</TabsContent>

					<TabsContent value="app" className="mt-0">
						<Card className="overflow-hidden border-2 border-primary/20 p-2">
							<div className="aspect-video bg-muted/50 flex items-center justify-center border-primary border-2 rounded-xl">
								{/* Placeholder for screenshot */}
								<img
									src="/screenshots/dashboard.png"
									alt="Full Application View"
									className="object-contain rounded-xl"
									onError={(e) => {
										e.currentTarget.style.display = "none";
										const parent = e.currentTarget.parentElement;
										if (parent) {
											const placeholder = document.createElement("div");
											placeholder.className =
												"flex flex-col items-center justify-center gap-4 p-8";
											placeholder.innerHTML = `
												<div class="text-6xl">💻</div>
												<p class="text-lg font-medium text-muted-foreground">Full Dashboard Experience</p>
												<p class="text-sm text-muted-foreground max-w-md text-center">
													Chat with AI on the left, browse issues and repos on the right. Real-time guidance with instant access to all features.
												</p>
											`;
											parent.appendChild(placeholder);
										}
									}}
								/>
							</div>
						</Card>
						<p className="text-center text-sm text-muted-foreground mt-4">
							Split-view interface with AI chat and interactive dashboard
						</p>
					</TabsContent>
				</Tabs>

				{/* Feature highlights below demo */}
				<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
					<div className="text-center">
						<div className="text-3xl font-bold text-primary mb-2">Sub-50ms</div>
						<p className="text-sm text-muted-foreground">
							Edge latency for real-time chat
						</p>
					</div>
					<div className="text-center">
						<div className="text-3xl font-bold text-primary mb-2">2x Daily</div>
						<p className="text-sm text-muted-foreground">
							Fresh issue updates from GitHub
						</p>
					</div>
					<div className="text-center">
						<div className="text-3xl font-bold text-primary mb-2">
							AI-Powered
						</div>
						<p className="text-sm text-muted-foreground">
							Summaries and difficulty scoring
						</p>
					</div>
					<div className="text-center">
						<div className="text-3xl font-bold text-primary mb-2">
							100% Free
						</div>
						<p className="text-sm text-muted-foreground">
							Open source and always will be
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
