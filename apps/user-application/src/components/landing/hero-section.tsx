import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Github, Sparkles, ArrowRight } from "lucide-react";

interface HeroSectionProps {
	isAuthenticated: boolean;
	userName?: string;
	onGetStarted: () => void;
	onGoToDashboard: () => void;
}

export function HeroSection({
	isAuthenticated,
	userName,
	onGetStarted,
	onGoToDashboard,
}: HeroSectionProps) {
	return (
		<section className="relative overflow-hidden px-6 lg:px-8 pt-32 pb-24 sm:pt-40 sm:pb-32">
			{/* Animated background gradients */}
			<div className="absolute inset-0 -z-10">
				<div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
				<div
					className="absolute top-0 -left-4 w-72 h-72 bg-primary rounded-full mix-blend-normal filter blur-3xl opacity-30 animate-blob"
					style={{ animationDelay: "0s" }}
				/>
				<div
					className="absolute top-0 -right-4 w-72 h-72 bg-accent rounded-full mix-blend-normal filter blur-3xl opacity-30 animate-blob"
					style={{ animationDelay: "2s" }}
				/>
				<div
					className="absolute -bottom-8 left-20 w-72 h-72 bg-primary/70 rounded-full mix-blend-normal filter blur-3xl opacity-30 animate-blob"
					style={{ animationDelay: "4s" }}
				/>
			</div>

			<div className="mx-auto max-w-6xl text-center">
				{/* Main headline */}
				<h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl animate-fade-in-up mb-6">
					{isAuthenticated ? (
						<>
							Welcome back, <br></br>
							<span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-[#FF6633]">
								{userName || "Developer"}!
							</span>
						</>
					) : (
						<>
							Make Your First
							<br />
							<span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-[#FF6633] animate-gradient-x">
								Open Source Contribution
							</span>
						</>
					)}
				</h1>

				{/* Subheading */}
				<p className="mt-6 text-xl leading-8 text-muted-foreground max-w-3xl mx-auto animate-fade-in-up">
					{isAuthenticated
						? "Continue your open source journey with personalized recommendations and AI-powered guidance."
						: "Discover beginner-friendly issues, understand codebases with AI assistance, and submit your first pull request with confidence."}
				</p>

				{/* CTA Buttons */}
				<div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up">
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
						<>
							<Button
								size="lg"
								className="text-lg px-8 py-6 group"
								onClick={onGetStarted}
							>
								<Github className="mr-2 h-5 w-5" />
								Start with GitHub
								<ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="text-lg px-8 py-6"
								onClick={() => {
									document.getElementById("features")?.scrollIntoView({
										behavior: "smooth",
									});
								}}
							>
								Learn More
							</Button>
						</>
					)}
				</div>

				{/* Stats or social proof could go here if available */}
			</div>
		</section>
	);
}
