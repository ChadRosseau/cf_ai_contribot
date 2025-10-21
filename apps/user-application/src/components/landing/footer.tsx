import { Github } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export function Footer() {
	return (
		<footer className="border-t bg-background">
			<div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
					{/* Brand Column */}
					<div className="md:col-span-2">
						<div className="flex items-center gap-2 mb-4">
							<Logo size="sm" />
						</div>
						<p className="text-sm text-muted-foreground max-w-md">
							AI-powered platform helping new developers discover and contribute
							to beginner-friendly open source projects.
						</p>
						<div className="flex items-center gap-4 mt-6">
							<a
								href="https://github.com"
								target="_blank"
								rel="noopener noreferrer"
								className="text-muted-foreground hover:text-foreground transition-colors"
							>
								<Github className="h-5 w-5" />
								<span className="sr-only">GitHub</span>
							</a>
						</div>
					</div>

					{/* Platform Column */}
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-4">
							Platform
						</h3>
						<ul className="space-y-3">
							<li>
								<a
									href="#features"
									className="text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									Features
								</a>
							</li>
							<li>
								<a
									href="#how-it-works"
									className="text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									How It Works
								</a>
							</li>
							<li>
								<a
									href="#architecture"
									className="text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									Architecture
								</a>
							</li>
							<li>
								<a
									href="#faq"
									className="text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									FAQ
								</a>
							</li>
						</ul>
					</div>

					{/* Resources Column */}
					<div>
						<h3 className="text-sm font-semibold text-foreground mb-4">
							Resources
						</h3>
						<ul className="space-y-3">
							<li>
								<a
									href="https://github.com"
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									GitHub
								</a>
							</li>
							<li>
								<a
									href="https://developers.cloudflare.com"
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									Cloudflare
								</a>
							</li>
							<li>
								<a
									href="https://opensource.guide"
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									Open Source Guide
								</a>
							</li>
						</ul>
					</div>
				</div>

				{/* Bottom Bar */}
				<div className="pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
					<p className="text-xs text-muted-foreground">
						© {new Date().getFullYear()} Contribot. Built with Cloudflare
						Workers, AI, and React.
					</p>
					<p className="text-xs text-muted-foreground">
						Open source and free forever
					</p>
				</div>
			</div>
		</footer>
	);
}
