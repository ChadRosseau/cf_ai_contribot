import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, GitBranch, Settings, List, Code2 } from "lucide-react";

interface Issue {
	id: number;
	issueNumber: number;
	title: string;
	url: string;
	owner: string;
	repoName: string;
	languages: string[];
	intro: string;
	difficulty: number;
	firstSteps: string;
}

export function DashboardView() {
	const [activeTab, setActiveTab] = useState<
		"overview" | "list" | "issue" | "settings"
	>("overview");
	const [issues, setIssues] = useState<Issue[]>([]);
	const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (activeTab === "list") {
			fetchRecommendedIssues();
		}
	}, [activeTab]);

	const fetchRecommendedIssues = async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/issues/recommended", {
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error("Issues response:", errorText);
				throw new Error("Failed to fetch issues");
			}

			const data = await response.json();
			setIssues(data.issues || []);
		} catch (error) {
			console.error("Failed to fetch issues:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleSelectIssue = (issue: Issue) => {
		setSelectedIssue(issue);
		setActiveTab("issue");
	};

	return (
		<div className="flex flex-col h-full">
			<div className="border-b p-4">
				<h2 className="font-semibold">Dashboard</h2>
			</div>

			<Tabs
				value={activeTab}
				onValueChange={(v) => setActiveTab(v as any)}
				className="flex-1 flex flex-col"
			>
				<TabsList className="mx-4 mt-4">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="list">Issues</TabsTrigger>
					<TabsTrigger value="settings">Settings</TabsTrigger>
				</TabsList>

				<div className="flex-1 overflow-y-auto p-4">
					<TabsContent value="overview" className="mt-0 space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Your Progress</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="p-4 border rounded-lg">
										<p className="text-2xl font-bold">0</p>
										<p className="text-sm text-muted-foreground">
											Issues Started
										</p>
									</div>
									<div className="p-4 border rounded-lg">
										<p className="text-2xl font-bold">0</p>
										<p className="text-sm text-muted-foreground">
											PRs Submitted
										</p>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Quick Actions</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								<Button
									variant="outline"
									className="w-full justify-start"
									onClick={() => setActiveTab("list")}
								>
									<List className="mr-2 h-4 w-4" />
									Browse Recommended Issues
								</Button>
								<Button
									variant="outline"
									className="w-full justify-start"
									disabled
								>
									<GitBranch className="mr-2 h-4 w-4" />
									View My Forks
								</Button>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="list" className="mt-0 space-y-4">
						{loading ? (
							<p className="text-center text-muted-foreground py-8">
								Loading issues...
							</p>
						) : issues.length === 0 ? (
							<Card>
								<CardContent className="py-8 text-center">
									<p className="text-muted-foreground">
										No issues found matching your preferences.
									</p>
									<Button
										variant="outline"
										className="mt-4"
										onClick={() => setActiveTab("settings")}
									>
										Update Preferences
									</Button>
								</CardContent>
							</Card>
						) : (
							issues.map((issue) => (
								<Card
									key={issue.id}
									className="cursor-pointer hover:bg-accent transition-colors"
									onClick={() => handleSelectIssue(issue)}
								>
									<CardHeader>
										<div className="flex items-start justify-between">
											<div className="space-y-1 flex-1">
												<CardTitle className="text-base">
													{issue.title}
												</CardTitle>
												<p className="text-sm text-muted-foreground">
													{issue.owner}/{issue.repoName}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
													Difficulty {issue.difficulty}/5
												</span>
											</div>
										</div>
									</CardHeader>
									<CardContent>
										<p className="text-sm text-muted-foreground mb-2">
											{issue.intro}
										</p>
										<div className="flex gap-2 flex-wrap">
											{issue.languages.slice(0, 3).map((lang) => (
												<span
													key={lang}
													className="text-xs px-2 py-1 rounded-full bg-muted"
												>
													{lang}
												</span>
											))}
										</div>
									</CardContent>
								</Card>
							))
						)}
					</TabsContent>

					<TabsContent value="issue" className="mt-0">
						{selectedIssue ? (
							<div className="space-y-4">
								<Button variant="ghost" onClick={() => setActiveTab("list")}>
									← Back to List
								</Button>

								<Card>
									<CardHeader>
										<CardTitle>{selectedIssue.title}</CardTitle>
										<p className="text-sm text-muted-foreground">
											{selectedIssue.owner}/{selectedIssue.repoName} #
											{selectedIssue.issueNumber}
										</p>
									</CardHeader>
									<CardContent className="space-y-4">
										<div>
											<h4 className="font-semibold mb-2">About this issue</h4>
											<p className="text-sm text-muted-foreground">
												{selectedIssue.intro}
											</p>
										</div>

										<div>
											<h4 className="font-semibold mb-2">First Steps</h4>
											<p className="text-sm text-muted-foreground">
												{selectedIssue.firstSteps}
											</p>
										</div>

										<div className="flex gap-2">
											<Button className="flex-1">
												<GitBranch className="mr-2 h-4 w-4" />
												Get Started
											</Button>
											<Button variant="outline" asChild>
												<a
													href={selectedIssue.url}
													target="_blank"
													rel="noopener noreferrer"
												>
													<ExternalLink className="h-4 w-4" />
												</a>
											</Button>
										</div>
									</CardContent>
								</Card>
							</div>
						) : (
							<Card>
								<CardContent className="py-8 text-center">
									<p className="text-muted-foreground">
										Select an issue to view details
									</p>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					<TabsContent value="settings" className="mt-0">
						<Card>
							<CardHeader>
								<CardTitle>Settings</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									Settings panel coming soon. You can update your language
									preferences and difficulty level here.
								</p>
							</CardContent>
						</Card>
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
