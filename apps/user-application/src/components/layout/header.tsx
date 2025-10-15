import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AccountDialog } from "@/components/auth/account-dialog";
import { Logo } from "@/components/ui/logo";
import { Bell, Search, Menu } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

interface HeaderProps {
    className?: string;
    onMobileMenuToggle?: () => void;
}

export function Header({ className, onMobileMenuToggle }: HeaderProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const { data: session } = authClient.useSession();

    const user = session?.user;
    const fallbackText = user?.name
        ? user.name.charAt(0).toUpperCase()
        : user?.email?.charAt(0).toUpperCase() || "U";

    return (
        <header
            className={cn(
                "flex h-16 items-center justify-between border-b border-border bg-background px-6",
                className
            )}
        >
            {/* Left side - Logo */}
            <div className="flex items-center gap-4">
                <Logo size="md" />
            </div>

            {/* Right side - Notifications and user menu */}
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive"></span>
                </Button>

                <AccountDialog>
                    <Button
                        variant="ghost"
                        className="flex items-center gap-2 px-3"
                    >
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
                            <span className="text-xs text-muted-foreground">
                                Online
                            </span>
                        </div>
                    </Button>
                </AccountDialog>
            </div>
        </header>
    );
}
