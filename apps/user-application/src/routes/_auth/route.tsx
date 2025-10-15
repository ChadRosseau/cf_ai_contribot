import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { GithubLogin } from "@/components/auth/github-login";
import { authClient } from "@/lib/auth-client";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_auth")({
    component: RouteComponent,
});

function RouteComponent() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [onboardingComplete, setOnboardingComplete] = useState<
        boolean | null
    >(null);
    const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(false);
    const session = authClient.useSession();

    // Check onboarding status when user is authenticated
    useEffect(() => {
        if (session.data?.user && !isCheckingOnboarding) {
            setIsCheckingOnboarding(true);
            checkOnboardingStatus();
        }
    }, [session.data?.user]);

    const checkOnboardingStatus = async () => {
        try {
            const response = await fetch("/api/user/preferences", {
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (response.ok) {
                const data = await response.json();
                setOnboardingComplete(data.onboardingCompleted);
            } else {
                setOnboardingComplete(false);
            }
        } catch (error) {
            console.error("Failed to check onboarding status:", error);
            setOnboardingComplete(false);
        } finally {
            setIsCheckingOnboarding(false);
        }
    };

    // Show loading while checking authentication or onboarding
    if (
        session.isPending ||
        (session.data?.user && onboardingComplete === null)
    ) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Redirect to onboarding if user is authenticated but hasn't completed onboarding
    if (session.data?.user && onboardingComplete === false) {
        return <Navigate to="/onboarding" />;
    }

    // Show login if not authenticated
    if (!session.data?.user) {
        return <GithubLogin />;
    }

    // Show app if authenticated and onboarding is complete
    return (
        <div className="flex h-screen bg-background overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto bg-muted/20">
                    <Header
                        onMobileMenuToggle={() =>
                            setIsMobileMenuOpen(!isMobileMenuOpen)
                        }
                    />
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
