import { useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ExternalLink,
    GitBranch,
    List,
    Star,
    ChevronLeft,
    ChevronRight,
    FolderGit2,
    Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useDashboard } from "@/lib/dashboard-context";
import { SettingsView } from "./components/settings-view";

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

interface Repo {
    id: number;
    owner: string;
    name: string;
    description: string;
    languages: string[];
    openIssuesCount: number;
    summary?: string;
}

const LANGUAGE_COLORS: Record<
    string,
    { bg: string; text: string; border: string }
> = {
    JavaScript: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        border: "border-yellow-300",
    },
    TypeScript: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        border: "border-blue-300",
    },
    Python: {
        bg: "bg-green-100",
        text: "text-green-800",
        border: "border-green-300",
    },
    Java: {
        bg: "bg-orange-100",
        text: "text-orange-800",
        border: "border-orange-300",
    },
    C: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
    "C++": {
        bg: "bg-blue-100",
        text: "text-blue-800",
        border: "border-blue-300",
    },
    "C#": {
        bg: "bg-purple-100",
        text: "text-purple-800",
        border: "border-purple-300",
    },
    Go: { bg: "bg-cyan-100", text: "text-cyan-800", border: "border-cyan-300" },
    Rust: {
        bg: "bg-orange-100",
        text: "text-orange-900",
        border: "border-orange-400",
    },
    Ruby: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300" },
    PHP: {
        bg: "bg-indigo-100",
        text: "text-indigo-800",
        border: "border-indigo-300",
    },
    Swift: {
        bg: "bg-orange-100",
        text: "text-orange-700",
        border: "border-orange-300",
    },
    Kotlin: {
        bg: "bg-purple-100",
        text: "text-purple-700",
        border: "border-purple-300",
    },
    Dart: {
        bg: "bg-blue-100",
        text: "text-blue-600",
        border: "border-blue-300",
    },
    Scala: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
    Haskell: {
        bg: "bg-purple-100",
        text: "text-purple-700",
        border: "border-purple-300",
    },
    Elixir: {
        bg: "bg-purple-100",
        text: "text-purple-600",
        border: "border-purple-300",
    },
    Erlang: {
        bg: "bg-red-100",
        text: "text-red-600",
        border: "border-red-300",
    },
    Clojure: {
        bg: "bg-green-100",
        text: "text-green-800",
        border: "border-green-300",
    },
    Julia: {
        bg: "bg-purple-100",
        text: "text-purple-700",
        border: "border-purple-300",
    },
    R: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
    Lua: {
        bg: "bg-blue-100",
        text: "text-blue-600",
        border: "border-blue-300",
    },
    HTML: {
        bg: "bg-orange-100",
        text: "text-orange-700",
        border: "border-orange-300",
    },
    CSS: {
        bg: "bg-blue-100",
        text: "text-blue-600",
        border: "border-blue-300",
    },
    Shell: {
        bg: "bg-green-100",
        text: "text-green-800",
        border: "border-green-300",
    },
    PowerShell: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        border: "border-blue-300",
    },
    Markdown: {
        bg: "bg-gray-100",
        text: "text-gray-700",
        border: "border-gray-300",
    },
    Makefile: {
        bg: "bg-green-100",
        text: "text-green-700",
        border: "border-green-300",
    },
    TeX: {
        bg: "bg-green-100",
        text: "text-green-800",
        border: "border-green-300",
    },
    Assembly: {
        bg: "bg-gray-100",
        text: "text-gray-800",
        border: "border-gray-300",
    },
    COBOL: {
        bg: "bg-blue-100",
        text: "text-blue-700",
        border: "border-blue-300",
    },
    CoffeeScript: {
        bg: "bg-gray-100",
        text: "text-gray-800",
        border: "border-gray-300",
    },
    "Objective-C": {
        bg: "bg-blue-100",
        text: "text-blue-700",
        border: "border-blue-300",
    },
    "Visual Basic .NET": {
        bg: "bg-blue-100",
        text: "text-blue-700",
        border: "border-blue-300",
    },
    C3: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
};

const getLanguageColor = (lang: string) => {
    return (
        LANGUAGE_COLORS[lang] || {
            bg: "bg-primary/20",
            text: "text-primary",
            border: "border-primary/30",
        }
    );
};

export function DashboardView() {
    const {
        state,
        setActiveTab,
        setRepos,
        setIssues,
        setSelectedIssue,
        setSelectedRepo,
        setReposPage,
        setIssuesPage,
        setReposTotalPages,
        setIssuesTotalPages,
        setIssuesFilters,
        setFavouriteRepos,
        setFavouriteIssues,
        setLoading,
        updateDashboardState,
    } = useDashboard();

    // Destructure state for easier access
    const {
        activeTab,
        repos,
        issues,
        selectedIssue,
        selectedRepo,
        reposPage,
        issuesPage,
        reposTotalPages,
        issuesTotalPages,
        favouriteRepos,
        favouriteIssues,
        loading,
        issuesFilters,
    } = state;

    const itemsPerPage = 10;

    // Helper to check if there are any active filters
    const hasActiveFilters = () => {
        if (selectedRepo) return true;
        if (!issuesFilters) return false;
        return !!(
            issuesFilters.repoFilter ||
            (issuesFilters.languages && issuesFilters.languages.length > 0) ||
            issuesFilters.difficulty
        );
    };

    // Track when data was set by agent vs user navigation to prevent duplicate fetches
    const lastFetchedReposPage = useRef(0);
    const lastFetchedIssuesPage = useRef(0);
    const lastFetchedSelectedRepo = useRef<string | null>(null);
    const lastFetchedFilters = useRef<string>("");
    const prevRepos = useRef<Repo[]>([]);
    const prevIssues = useRef<Issue[]>([]);

    // When agent provides new data (detected by array reference change), update the refs to prevent duplicate API fetches
    useEffect(() => {
        if (repos.length > 0 && repos !== prevRepos.current) {
            lastFetchedReposPage.current = reposPage;
            prevRepos.current = repos;
        }
    }, [repos, reposPage]);

    useEffect(() => {
        if (issues.length > 0 && issues !== prevIssues.current) {
            lastFetchedIssuesPage.current = issuesPage;
            lastFetchedSelectedRepo.current = selectedRepo;

            // Also update filter tracking when agent provides data
            const filters = issuesFilters
                ? {
                      repoFilter: issuesFilters.repoFilter,
                      languages: issuesFilters.languages,
                      difficulty: issuesFilters.difficulty,
                  }
                : selectedRepo
                ? { repoFilter: selectedRepo }
                : undefined;
            lastFetchedFilters.current = JSON.stringify(filters || {});

            prevIssues.current = issues;
        }
    }, [issues, issuesPage, selectedRepo, issuesFilters]);

    const fetchRepos = useCallback(
        async (page: number) => {
            lastFetchedReposPage.current = page;
            setLoading(true);
            try {
                const response = await fetch(
                    `/api/repos/recommended?page=${page}&limit=${itemsPerPage}`,
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Repos response:", errorText);
                    throw new Error("Failed to fetch repos");
                }

                const data = (await response.json()) as {
                    repos: Repo[];
                    total: number;
                };
                setRepos(data.repos || []);
                setReposTotalPages(Math.ceil((data.total || 0) / itemsPerPage));

                // Sync to agent state (UI-initiated query)
                updateDashboardState({
                    repos: data.repos || [],
                    reposPage: page,
                    reposTotalPages: Math.ceil(
                        (data.total || 0) / itemsPerPage
                    ),
                });
            } catch (error) {
                console.error("Failed to fetch repos:", error);
            } finally {
                setLoading(false);
            }
        },
        [setLoading, setRepos, setReposTotalPages, updateDashboardState]
    );

    const fetchRecommendedIssues = useCallback(
        async (
            page: number,
            filters?: {
                repoFilter?: string;
                languages?: string[];
                difficulty?: number;
            }
        ) => {
            lastFetchedIssuesPage.current = page;
            lastFetchedSelectedRepo.current = filters?.repoFilter || null;
            setLoading(true);
            try {
                let url = `/api/issues/recommended?page=${page}&limit=${itemsPerPage}`;
                if (filters?.repoFilter) {
                    url += `&repo=${encodeURIComponent(filters.repoFilter)}`;
                }
                if (filters?.languages && filters.languages.length > 0) {
                    url += `&languages=${filters.languages
                        .map(encodeURIComponent)
                        .join(",")}`;
                }
                if (filters?.difficulty) {
                    url += `&difficulty=${filters.difficulty}`;
                }

                const response = await fetch(url, {
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Issues response:", errorText);
                    throw new Error("Failed to fetch issues");
                }

                const data = (await response.json()) as {
                    issues: Issue[];
                    total: number;
                };
                setIssues(data.issues || []);
                setIssuesTotalPages(
                    Math.ceil((data.total || 0) / itemsPerPage)
                );

                // Sync to agent state (UI-initiated query)
                updateDashboardState({
                    issues: data.issues || [],
                    issuesPage: page,
                    issuesTotalPages: Math.ceil(
                        (data.total || 0) / itemsPerPage
                    ),
                    issuesFilters: filters || {},
                });
            } catch (error) {
                console.error("Failed to fetch issues:", error);
            } finally {
                setLoading(false);
            }
        },
        [setLoading, setIssues, setIssuesTotalPages, updateDashboardState]
    );

    // Load favourites on mount
    useEffect(() => {
        const loadFavourites = async () => {
            try {
                const response = await fetch("/api/user/favourites");
                if (response.ok) {
                    const data = (await response.json()) as {
                        repos: number[];
                        issues: number[];
                    };
                    setFavouriteRepos(new Set(data.repos || []));
                    setFavouriteIssues(new Set(data.issues || []));
                }
            } catch (error) {
                console.error("Failed to load favourites:", error);
            }
        };
        loadFavourites();
    }, [setFavouriteRepos, setFavouriteIssues]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: fetchRepos and fetchRecommendedIssues are stable functions
    useEffect(() => {
        // Only fetch if we haven't already fetched this exact page
        // This prevents duplicate fetches when agent updates both data AND page number
        if (
            activeTab === "repos" &&
            lastFetchedReposPage.current !== reposPage
        ) {
            fetchRepos(reposPage);
        } else if (activeTab === "list") {
            // Use stored filters if available (from agent), otherwise just use selectedRepo
            const filters = issuesFilters
                ? {
                      repoFilter: issuesFilters.repoFilter,
                      languages: issuesFilters.languages,
                      difficulty: issuesFilters.difficulty,
                  }
                : selectedRepo
                ? { repoFilter: selectedRepo }
                : undefined;

            // Serialize filters for comparison
            const currentFiltersString = JSON.stringify(filters || {});

            // Fetch if: page changed, selectedRepo changed, or filters changed
            if (
                lastFetchedIssuesPage.current !== issuesPage ||
                lastFetchedSelectedRepo.current !== (selectedRepo || null) ||
                lastFetchedFilters.current !== currentFiltersString
            ) {
                lastFetchedFilters.current = currentFiltersString;
                fetchRecommendedIssues(issuesPage, filters);
            }
        }
    }, [activeTab, reposPage, issuesPage, selectedRepo, issuesFilters]);

    const handleSelectIssue = (issue: Issue) => {
        setSelectedIssue(issue);
        setActiveTab("issue");
    };

    const handleSelectRepo = (repo: Repo) => {
        setSelectedRepo(`${repo.owner}/${repo.name}`);
        setIssuesPage(1);
        setActiveTab("list");
    };

    const toggleFavouriteRepoHandler = async (
        repoId: number,
        e: React.MouseEvent
    ) => {
        e.stopPropagation();
        const newFavourites = new Set(favouriteRepos);
        if (newFavourites.has(repoId)) {
            newFavourites.delete(repoId);
        } else {
            newFavourites.add(repoId);
        }
        setFavouriteRepos(newFavourites);

        try {
            await fetch("/api/user/favourites/repos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    repoId,
                    favourite: newFavourites.has(repoId),
                }),
            });
        } catch (error) {
            console.error("Failed to update favourite:", error);
        }
    };

    const toggleFavouriteIssueHandler = async (
        issueId: number,
        e: React.MouseEvent
    ) => {
        e.stopPropagation();
        const newFavourites = new Set(favouriteIssues);
        if (newFavourites.has(issueId)) {
            newFavourites.delete(issueId);
        } else {
            newFavourites.add(issueId);
        }
        setFavouriteIssues(newFavourites);

        try {
            await fetch("/api/user/favourites/issues", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    issueId,
                    favourite: newFavourites.has(issueId),
                }),
            });
        } catch (error) {
            console.error("Failed to update favourite:", error);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <Tabs
                value={activeTab}
                onValueChange={(v) =>
                    setActiveTab(
                        v as
                            | "overview"
                            | "repos"
                            | "list"
                            | "issue"
                            | "favourites"
                            | "settings"
                    )
                }
                className="flex-1 flex flex-col overflow-hidden"
            >
                <TabsList className="mx-4 mt-5 bg-white/90 backdrop-blur-sm shadow-lg">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="repos">Repos</TabsTrigger>
                    <TabsTrigger value="list">Issues</TabsTrigger>
                    <TabsTrigger value="favourites">Favourites</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-scroll p-4 space-y-4 max-h-[calc(100vh)] mt-3">
                    <TabsContent value="overview" className="mt-0 space-y-4">
                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
                            <CardHeader>
                                <CardTitle>Your Progress</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 border rounded-lg bg-white/50">
                                        <p className="text-2xl font-bold">0</p>
                                        <p className="text-sm text-muted-foreground">
                                            Issues Started
                                        </p>
                                    </div>
                                    <div className="p-4 border rounded-lg bg-white/50">
                                        <p className="text-2xl font-bold">0</p>
                                        <p className="text-sm text-muted-foreground">
                                            PRs Submitted
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
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

                    <TabsContent value="repos" className="mt-0 space-y-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-8 min-h-[80vh]">
                                <Loader2 className="h-8 w-8 text-white animate-spin" />
                            </div>
                        ) : repos.length === 0 ? (
                            <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
                                <CardContent className="py-8 text-center">
                                    <p className="text-muted-foreground">
                                        No repositories found.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                {repos.map((repo) => (
                                    <Card
                                        key={repo.id}
                                        className="cursor-pointer hover:bg-accent transition-colors bg-white/90 backdrop-blur-sm shadow-lg"
                                        onClick={() => handleSelectRepo(repo)}
                                    >
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                                                        <CardTitle className="text-base">
                                                            {repo.owner}/
                                                            {repo.name}
                                                        </CardTitle>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {repo.openIssuesCount}{" "}
                                                        open{" "}
                                                        {repo.openIssuesCount ===
                                                        1
                                                            ? "issue"
                                                            : "issues"}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) =>
                                                        toggleFavouriteRepoHandler(
                                                            repo.id,
                                                            e
                                                        )
                                                    }
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <Star
                                                        className={`h-4 w-4 ${
                                                            favouriteRepos.has(
                                                                repo.id
                                                            )
                                                                ? "fill-yellow-400 text-yellow-400"
                                                                : "text-muted-foreground"
                                                        }`}
                                                    />
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            {repo.summary && (
                                                <div className="text-sm text-muted-foreground mb-2 prose prose-sm max-w-none">
                                                    <ReactMarkdown>
                                                        {repo.summary}
                                                    </ReactMarkdown>
                                                </div>
                                            )}
                                            <div className="flex gap-2 flex-wrap">
                                                {repo.languages
                                                    .slice(0, 3)
                                                    .map((lang: string) => {
                                                        const colors =
                                                            getLanguageColor(
                                                                lang
                                                            );
                                                        return (
                                                            <span
                                                                key={lang}
                                                                className={`text-xs px-3 py-1 rounded-full font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                                                            >
                                                                {lang}
                                                            </span>
                                                        );
                                                    })}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                {reposTotalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 py-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setReposPage(
                                                    Math.max(1, reposPage - 1)
                                                )
                                            }
                                            disabled={
                                                reposPage === 1 || loading
                                            }
                                            className="bg-white/90 backdrop-blur-sm"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-sm text-white">
                                            Page {reposPage} of{" "}
                                            {reposTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setReposPage(
                                                    Math.min(
                                                        reposTotalPages,
                                                        reposPage + 1
                                                    )
                                                )
                                            }
                                            disabled={
                                                reposPage === reposTotalPages ||
                                                loading
                                            }
                                            className="bg-white/90 backdrop-blur-sm"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="list" className="mt-0 space-y-4">
                        {hasActiveFilters() && (
                            <Card className="bg-white/90 backdrop-blur-sm shadow-lg py-3">
                                <CardContent className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium">
                                            Active Filters:
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedRepo(null);
                                                setIssuesFilters({});
                                                setIssuesPage(1);
                                            }}
                                        >
                                            Clear all
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {(issuesFilters?.repoFilter ||
                                            selectedRepo) && (
                                            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs">
                                                <span>
                                                    Repository:{" "}
                                                    {issuesFilters?.repoFilter ||
                                                        selectedRepo}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-4 w-4 p-0 hover:bg-blue-200"
                                                    onClick={() => {
                                                        setSelectedRepo(null);
                                                        setIssuesFilters({
                                                            ...issuesFilters,
                                                            repoFilter:
                                                                undefined,
                                                        });
                                                        setIssuesPage(1);
                                                    }}
                                                >
                                                    ×
                                                </Button>
                                            </div>
                                        )}
                                        {issuesFilters?.languages &&
                                            issuesFilters.languages.length >
                                                0 && (
                                                <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs">
                                                    <span>
                                                        Languages:{" "}
                                                        {issuesFilters.languages.join(
                                                            ", "
                                                        )}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-4 w-4 p-0 hover:bg-green-200"
                                                        onClick={() => {
                                                            setIssuesFilters({
                                                                ...issuesFilters,
                                                                languages:
                                                                    undefined,
                                                            });
                                                            setIssuesPage(1);
                                                        }}
                                                    >
                                                        ×
                                                    </Button>
                                                </div>
                                            )}
                                        {issuesFilters?.difficulty && (
                                            <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-xs">
                                                <span>
                                                    Difficulty:{" "}
                                                    {issuesFilters.difficulty}/5
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-4 w-4 p-0 hover:bg-purple-200"
                                                    onClick={() => {
                                                        setIssuesFilters({
                                                            ...issuesFilters,
                                                            difficulty:
                                                                undefined,
                                                        });
                                                        setIssuesPage(1);
                                                    }}
                                                >
                                                    ×
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center py-8 min-h-[80vh]">
                                <Loader2 className="h-8 w-8 text-white animate-spin" />
                            </div>
                        ) : issues.length === 0 ? (
                            <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
                                <CardContent className="py-8 text-center">
                                    <p className="text-muted-foreground">
                                        No issues found matching your
                                        preferences.
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
                            <>
                                {issues.map((issue) => (
                                    <Card
                                        key={issue.id}
                                        className="cursor-pointer hover:bg-accent transition-colors bg-white/90 backdrop-blur-sm shadow-lg"
                                        onClick={() => handleSelectIssue(issue)}
                                    >
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1 flex-1">
                                                    <CardTitle className="text-base">
                                                        {issue.title}
                                                    </CardTitle>
                                                    <p className="text-sm text-muted-foreground">
                                                        {issue.owner}/
                                                        {issue.repoName}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                                                        Difficulty{" "}
                                                        {issue.difficulty}/5
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) =>
                                                            toggleFavouriteIssueHandler(
                                                                issue.id,
                                                                e
                                                            )
                                                        }
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Star
                                                            className={`h-4 w-4 ${
                                                                favouriteIssues.has(
                                                                    issue.id
                                                                )
                                                                    ? "fill-yellow-400 text-yellow-400"
                                                                    : "text-muted-foreground"
                                                            }`}
                                                        />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm text-muted-foreground mb-2 prose prose-sm max-w-none">
                                                <ReactMarkdown>
                                                    {issue.intro}
                                                </ReactMarkdown>
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                                {issue.languages
                                                    .slice(0, 3)
                                                    .map((lang: string) => {
                                                        const colors =
                                                            getLanguageColor(
                                                                lang
                                                            );
                                                        return (
                                                            <span
                                                                key={lang}
                                                                className={`text-xs px-3 py-1 rounded-full font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                                                            >
                                                                {lang}
                                                            </span>
                                                        );
                                                    })}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}

                                {issuesTotalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 py-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setIssuesPage(
                                                    Math.max(1, issuesPage - 1)
                                                )
                                            }
                                            disabled={
                                                issuesPage === 1 || loading
                                            }
                                            className="bg-white/90 backdrop-blur-sm"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-sm text-white">
                                            Page {issuesPage} of{" "}
                                            {issuesTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setIssuesPage(
                                                    Math.min(
                                                        issuesTotalPages,
                                                        issuesPage + 1
                                                    )
                                                )
                                            }
                                            disabled={
                                                issuesPage ===
                                                    issuesTotalPages || loading
                                            }
                                            className="bg-white/90 backdrop-blur-sm"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="issue" className="mt-0">
                        {selectedIssue ? (
                            <div className="space-y-4">
                                <Button
                                    variant="ghost"
                                    onClick={() => setActiveTab("list")}
                                    className="text-white hover:text-white/80"
                                >
                                    ← Back to List
                                </Button>

                                <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
                                    <CardHeader>
                                        <CardTitle>
                                            {selectedIssue.title}
                                        </CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedIssue.owner}/
                                            {selectedIssue.repoName} #
                                            {selectedIssue.issueNumber}
                                        </p>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div>
                                            <h4 className="font-semibold mb-2">
                                                About this issue
                                            </h4>
                                            <div className="text-sm text-muted-foreground prose prose-sm max-w-none">
                                                <ReactMarkdown>
                                                    {selectedIssue.intro}
                                                </ReactMarkdown>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="font-semibold mb-2">
                                                First Steps
                                            </h4>
                                            <div className="text-sm text-muted-foreground prose prose-sm max-w-none">
                                                <ReactMarkdown>
                                                    {selectedIssue.firstSteps}
                                                </ReactMarkdown>
                                            </div>
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
                            <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
                                <CardContent className="py-8 text-center">
                                    <p className="text-muted-foreground">
                                        Select an issue to view details
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="favourites" className="mt-0 space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-4">
                                Favourite Repositories
                            </h3>
                            {repos.filter((r) => favouriteRepos.has(r.id))
                                .length === 0 ? (
                                <p className="text-sm text-white/70">
                                    No favourite repositories yet. Star repos to
                                    see them here.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {repos
                                        .filter((r) => favouriteRepos.has(r.id))
                                        .map((repo) => (
                                            <Card
                                                key={repo.id}
                                                className="p-4 cursor-pointer hover:bg-accent transition-colors bg-white/90 backdrop-blur-sm shadow-lg"
                                                onClick={() =>
                                                    handleSelectRepo(repo)
                                                }
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-semibold text-base">
                                                            {repo.owner}/
                                                            {repo.name}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) =>
                                                            toggleFavouriteRepoHandler(
                                                                repo.id,
                                                                e
                                                            )
                                                        }
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                    </Button>
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-2">
                                                    {repo.openIssuesCount} open{" "}
                                                    {repo.openIssuesCount === 1
                                                        ? "issue"
                                                        : "issues"}
                                                </p>
                                                <div className="flex gap-2 flex-wrap mt-2">
                                                    {repo.languages
                                                        .slice(0, 3)
                                                        .map((lang: string) => {
                                                            const colors =
                                                                getLanguageColor(
                                                                    lang
                                                                );
                                                            return (
                                                                <span
                                                                    key={lang}
                                                                    className={`text-xs px-3 py-1 rounded-full font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                                                                >
                                                                    {lang}
                                                                </span>
                                                            );
                                                        })}
                                                </div>
                                            </Card>
                                        ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-white mb-4">
                                Favourite Issues
                            </h3>
                            {issues.filter((i) => favouriteIssues.has(i.id))
                                .length === 0 ? (
                                <p className="text-sm text-white/70">
                                    No favourite issues yet. Star issues to see
                                    them here.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {issues
                                        .filter((i) =>
                                            favouriteIssues.has(i.id)
                                        )
                                        .map((issue) => (
                                            <Card
                                                key={issue.id}
                                                className="p-4 cursor-pointer hover:bg-accent transition-colors bg-white/90 backdrop-blur-sm shadow-lg"
                                                onClick={() =>
                                                    handleSelectIssue(issue)
                                                }
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-base">
                                                            {issue.title}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            {issue.owner}/
                                                            {issue.repoName}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) =>
                                                            toggleFavouriteIssueHandler(
                                                                issue.id,
                                                                e
                                                            )
                                                        }
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                    </Button>
                                                </div>
                                                <div className="flex gap-2 flex-wrap mt-2">
                                                    {issue.languages
                                                        .slice(0, 3)
                                                        .map((lang: string) => {
                                                            const colors =
                                                                getLanguageColor(
                                                                    lang
                                                                );
                                                            return (
                                                                <span
                                                                    key={lang}
                                                                    className={`text-xs px-3 py-1 rounded-full font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                                                                >
                                                                    {lang}
                                                                </span>
                                                            );
                                                        })}
                                                </div>
                                            </Card>
                                        ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="settings" className="mt-0">
                        <SettingsView
                            onSave={() => {
                                // After saving, update context state and navigate
                                // The SettingsView already saved to DB
                                // We need to refresh the context from DB or refetch
                                setIssuesPage(1);
                                setReposPage(1);
                                setActiveTab("overview");
                                // Optionally: refetch preferences to update context
                                // For now, the context will update on next page load
                            }}
                            onCancel={() => setActiveTab("overview")}
                        />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
