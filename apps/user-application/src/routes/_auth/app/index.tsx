import { createFileRoute } from "@tanstack/react-router";
import { ChatInterface } from "@/components/chat/chat-interface";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DashboardProvider } from "@/lib/dashboard-context";

export const Route = createFileRoute("/_auth/app/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<DashboardProvider>
			<div className="min-h-screen  flex flex-col">
				<div className="bg-gradient-to-br from-[#FBAD41] to-[#FF6633] absolute top-0 right-0 w-2/3 h-full "></div>
				<div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="bg-white rounded-lg shadow-2xl overflow-hidden z-10 chat-scrollbar">
						<ChatInterface />
					</div>
					<div className="bg-transparent md:max-h-screen z-30 dashboard-scrollbar">
						<DashboardView />
					</div>
				</div>
			</div>
		</DashboardProvider>
	);
}
