import { createFileRoute } from "@tanstack/react-router";
import { ChatInterface } from "@/components/chat/chat-interface";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { Logo } from "@/components/ui/logo";

export const Route = createFileRoute("/_auth/app/")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <div className="h-screen flex flex-col">
            <header className="border-b px-4 py-3 flex items-center justify-between">
                <Logo size="md" />
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                        Welcome back!
                    </span>
                </div>
            </header>

            <div className="flex-1 grid md:grid-cols-2 overflow-hidden">
                <div className="border-r">
                    <ChatInterface />
                </div>
                <div>
                    <DashboardView />
                </div>
            </div>
        </div>
    );
}
