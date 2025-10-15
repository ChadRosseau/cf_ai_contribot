import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
    Github,
    Sparkles,
    Code2,
    GitBranch,
    MessageSquare,
    LogIn,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AccountDialog } from "@/components/auth/account-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { useEffect } from "react";

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

    const user = session?.user;
    const fallbackText = user?.name
        ? user.name.charAt(0).toUpperCase()
        : user?.email?.charAt(0).toUpperCase() || "U";

    // Redirect to app if user is signed in
    useEffect(() => {
        if (session?.user) {
            navigate({ to: "/app" });
        }
    }, [session, navigate]);

    return (
        <div className="min-h-screen bg-background">
            <nav className="border-b">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Logo size="md" />
                    </div>
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

            <main>
                <section className="container mx-auto px-4 py-24 text-center">
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                            <Sparkles className="h-4 w-4" />
                            AI-Powered Open Source Onboarding
                        </div>

                        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                            {session ? (
                                <>
                                    Welcome back,{" "}
                                    <span className="text-primary">
                                        {user?.name || "Developer"}
                                    </span>
                                    !
                                    <br />
                                    <span className="text-3xl md:text-4xl">
                                        Ready to contribute?
                                    </span>
                                </>
                            ) : (
                                <>
                                    Make Your First
                                    <br />
                                    <span className="text-primary">
                                        Open Source Contribution
                                    </span>
                                </>
                            )}
                        </h1>

                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            {session
                                ? "Continue your open source journey with personalized recommendations and AI-powered guidance."
                                : "An AI assistant that helps new developers discover beginner-friendly issues, understand codebases, and submit their first pull requests with confidence."}
                        </p>

                        <div className="flex items-center justify-center gap-4 pt-4">
                            {session ? (
                                <Button
                                    size="lg"
                                    className="text-lg"
                                    onClick={() => navigate({ to: "/app" })}
                                >
                                    <Code2 className="mr-2 h-5 w-5" />
                                    Go to Dashboard
                                </Button>
                            ) : (
                                <Button
                                    size="lg"
                                    className="text-lg"
                                    onClick={handleGithubSignIn}
                                >
                                    <Github className="mr-2 h-5 w-5" />
                                    Start with GitHub
                                </Button>
                            )}
                        </div>
                    </div>
                </section>

                <section className="container mx-auto px-4 py-16">
                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        <div className="space-y-3 text-center p-6 rounded-lg border bg-card">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                                <MessageSquare className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold">
                                AI Chat Guide
                            </h3>
                            <p className="text-muted-foreground">
                                Chat with an AI assistant that understands
                                GitHub workflows and guides you through every
                                step
                            </p>
                        </div>

                        <div className="space-y-3 text-center p-6 rounded-lg border bg-card">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                                <Code2 className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold">
                                Smart Matching
                            </h3>
                            <p className="text-muted-foreground">
                                Find issues that match your skills and interests
                                with AI-powered difficulty scoring
                            </p>
                        </div>

                        <div className="space-y-3 text-center p-6 rounded-lg border bg-card">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                                <GitBranch className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold">
                                Automated Actions
                            </h3>
                            <p className="text-muted-foreground">
                                Fork repos, create branches, and open PRs with
                                one click or through natural conversation
                            </p>
                        </div>
                    </div>
                </section>

                {!session && (
                    <section className="container mx-auto px-4 py-16 text-center">
                        <div className="max-w-2xl mx-auto space-y-6">
                            <h2 className="text-3xl md:text-4xl font-bold">
                                Ready to contribute?
                            </h2>
                            <p className="text-lg text-muted-foreground">
                                Join thousands of developers making their first
                                open source contributions
                            </p>
                            <Button
                                size="lg"
                                className="text-lg"
                                onClick={handleGithubSignIn}
                            >
                                <Github className="mr-2 h-5 w-5" />
                                Sign in with GitHub
                            </Button>
                        </div>
                    </section>
                )}
            </main>

            <footer className="border-t mt-16">
                <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
                    <p>Built with Cloudflare Workers, AI, and ❤️</p>
                </div>
            </footer>
        </div>
    );
}
