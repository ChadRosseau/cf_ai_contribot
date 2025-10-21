import { Button } from "@/components/ui/button";
import { Github, ArrowRight } from "lucide-react";

interface CtaSectionProps {
	isAuthenticated: boolean;
	onGetStarted: () => void;
	onGoToDashboard: () => void;
}

export function CtaSection({
	isAuthenticated,
	onGetStarted,
	onGoToDashboard,
}: CtaSectionProps) {
	return (
		<section className="py-24 sm:py-32 relative overflow-hidden">
			{/* Gradient background */}
			<div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
			<div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background))_100%)]" />

			<div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
				<h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl mb-6">
					{isAuthenticated ? (
						<>
							Ready to continue
							<span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-[#FF6633]">
								{" "}
								your journey
							</span>
							?
						</>
					) : (
						<>
							Ready to make your first
							<span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-[#FF6633]">
								{" "}
								contribution
							</span>
							?
						</>
					)}
				</h2>
				<p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
					{isAuthenticated
						? "Head to your dashboard to explore new issues and continue contributing."
						: "Join the open source community today. It's free, beginner-friendly, and takes less than 60 seconds to get started."}
				</p>
				<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
					{isAuthenticated ? (
						<Button
							size="lg"
							className="text-lg px-8 py-6 group"
							onClick={onGoToDashboard}
						>
							Go to Dashboard
							<ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
						</Button>
					) : (
						<Button
							size="lg"
							className="text-lg px-8 py-6 group"
							onClick={onGetStarted}
						>
							<Github className="mr-2 h-5 w-5" />
							Start with GitHub
							<ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
						</Button>
					)}
				</div>
			</div>
		</section>
	);
}
