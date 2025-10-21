import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AccountDialog } from "@/components/auth/account-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import {
	HeroSection,
	FeaturesSection,
	HowItWorksSection,
	DemoSection,
	ArchitectureSection,
	FaqSection,
	Footer,
	CtaSection,
} from "@/components/landing";

export const Route = createFileRoute("/")({
	component: LandingPage,
});

function LandingPage() {
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();

	const handleGithubSignIn = async () => {
		await authClient.signIn.social({
			provider: "github",
		});
	};

	const handleGoToDashboard = () => {
		navigate({ to: "/app" });
	};

	const user = session?.user;
	const fallbackText = user?.name
		? user.name.charAt(0).toUpperCase()
		: user?.email?.charAt(0).toUpperCase() || "U";

	return (
		<div className="min-h-screen bg-background">
			{/* Navigation */}
			<nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-lg">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<button
						type="button"
						className="flex items-center gap-2 hover:opacity-80 transition-opacity"
						onClick={() => navigate({ to: "/" })}
					>
						<Logo size="md" />
					</button>
					<div className="flex items-center gap-4">
						{session ? (
							<AccountDialog>
								<Button
									variant="ghost"
									className="flex items-center gap-2 px-3"
								>
									<Avatar className="h-7 w-7">
										<AvatarImage
											src={user?.image || undefined}
											alt={user?.name || "User"}
										/>
										<AvatarFallback className="bg-primary text-primary-foreground text-xs">
											{fallbackText}
										</AvatarFallback>
									</Avatar>
									<span className="text-sm font-medium">
										{user?.name || "Account"}
									</span>
								</Button>
							</AccountDialog>
						) : (
							<>
								<Button
									variant="ghost"
									onClick={handleGithubSignIn}
									className="hidden sm:flex"
								>
									Sign In
								</Button>
								<Button onClick={handleGithubSignIn}>
									<Github className="mr-2 h-4 w-4" />
									Get Started
								</Button>
							</>
						)}
					</div>
				</div>
			</nav>

			{/* Main Content */}
			<main className="pt-16">
				<HeroSection
					isAuthenticated={!!session}
					userName={user?.name}
					onGetStarted={handleGithubSignIn}
					onGoToDashboard={handleGoToDashboard}
				/>

				<FeaturesSection />

				{/* eslint-disable-next-line react/no-unknown-property */}
				<div id="how-it-works">
					<HowItWorksSection />
				</div>

				<DemoSection />

				{/* eslint-disable-next-line react/no-unknown-property */}
				<div id="architecture">
					<ArchitectureSection />
				</div>

				{/* eslint-disable-next-line react/no-unknown-property */}
				<div id="faq">
					<FaqSection />
				</div>

				<CtaSection
					isAuthenticated={!!session}
					onGetStarted={handleGithubSignIn}
					onGoToDashboard={handleGoToDashboard}
				/>
			</main>

			<Footer />
		</div>
	);
}
