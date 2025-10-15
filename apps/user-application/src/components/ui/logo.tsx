import { Code2 } from "lucide-react";

interface LogoProps {
    className?: string;
    showText?: boolean;
    size?: "sm" | "md" | "lg";
}

export function Logo({
    className = "",
    showText = true,
    size = "md",
}: LogoProps) {
    const sizeClasses = {
        sm: "h-6 w-6",
        md: "h-8 w-8",
        lg: "h-12 w-12",
    };

    const textSizeClasses = {
        sm: "text-lg",
        md: "text-xl",
        lg: "text-2xl",
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div
                className={`${sizeClasses[size]} bg-contain bg-no-repeat bg-center bg-[url(/logo.svg)]`}
            ></div>
            {showText && (
                <span
                    className={`font-bold ${textSizeClasses[size]} bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent`}
                >
                    Contribot
                </span>
            )}
        </div>
    );
}
