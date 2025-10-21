import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AccountDialog } from "@/components/auth/account-dialog";
import { Logo } from "@/components/ui/logo";
import { Bell, Search, Menu } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Card } from "../ui/card";
import { useNavigate } from "@tanstack/react-router";

interface HeaderProps {
	className?: string;
	onMobileMenuToggle?: () => void;
}

export function Header({ className, onMobileMenuToggle }: HeaderProps) {
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();

	const user = session?.user;
	const fallbackText = user?.name
		? user.name.charAt(0).toUpperCase()
		: user?.email?.charAt(0).toUpperCase() || "U";

	return (
		<header
			className={cn(
				"flex h-18 items-center justify-between  bg-transparent absolute top-0 left-0 w-full px-6 py-4 z-20 pointer-events-none",
				className,
			)}
		>
			{/* Left side - Logo */}
			<button
				type="button"
				className="flex items-center gap-4 pointer-events-auto"
				onClick={() => {
					navigate({ to: "/" });
				}}
			>
				<Logo size="md" showText={false} />
			</button>

			{/* Right side - Notifications and user menu */}
			<div className="flex items-center gap-2 pointer-events-auto">
				<Card className="py-2">
					<AccountDialog>
						<Button variant="ghost" className="flex items-center gap-2 px-3">
							<Avatar className="h-8 w-8">
								<AvatarImage
									src={user?.image || undefined}
									alt={user?.name || "User"}
								/>
								<AvatarFallback className="bg-primary text-primary-foreground text-sm">
									{fallbackText}
								</AvatarFallback>
							</Avatar>
							<div className="hidden sm:flex flex-col items-start">
								<span className="text-sm font-medium">
									{user?.name || "User"}
								</span>
								<span className="text-xs text-muted-foreground">Online</span>
							</div>
						</Button>
					</AccountDialog>
				</Card>
			</div>
		</header>
	);
}
