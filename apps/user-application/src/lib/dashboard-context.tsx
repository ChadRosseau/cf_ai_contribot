import {
    createContext,
    useContext,
    useState,
    useRef,
    type ReactNode,
} from "react";

export type DashboardTab =
    | "overview"
    | "repos"
    | "list"
    | "issue"
    | "favourites"
    | "settings";

// biome-ignore lint/suspicious/noExplicitAny: Agent returns dynamic issue data
export type Issue = any;
// biome-ignore lint/suspicious/noExplicitAny: Agent returns dynamic repo data
export type Repo = any;

interface DashboardState {
    // Navigation
    activeTab: DashboardTab;

    // Content state
    repos: Repo[];
    issues: Issue[];
    selectedIssue: Issue | null;
    selectedRepo: string | null;

    // Pagination
    reposPage: number;
    issuesPage: number;
    reposTotalPages: number;
    issuesTotalPages: number;

    // Filters (persisted for pagination)
    // Always an object, use empty object {} for no filters
    issuesFilters: {
        languages?: string[];
        difficulty?: number;
        repoFilter?: string;
    };

    // Favourites
    favouriteRepos: Set<number>;
    favouriteIssues: Set<number>;

    // Settings
    selectedLanguages: string[];
    difficulty: number;

    // Loading states
    loading: boolean;
    savingSettings: boolean;
    scanningGitHub: boolean;

    // Agent-provided data (for backwards compatibility)
    activeIssueId?: number;
    activeRepoId?: number;
    lastAction?: string;
    forkedRepoName?: string;
    branchName?: string;
}

interface DashboardContextValue {
    // State
    state: DashboardState;

    // Navigation actions
    setActiveTab: (tab: DashboardTab) => void;

    // Content actions
    setRepos: (repos: Repo[]) => void;
    setIssues: (issues: Issue[]) => void;
    setSelectedIssue: (issue: Issue | null) => void;
    setSelectedRepo: (repo: string | null) => void;

    // Pagination actions
    setReposPage: (page: number) => void;
    setIssuesPage: (page: number) => void;
    setReposTotalPages: (pages: number) => void;
    setIssuesTotalPages: (pages: number) => void;

    // Filter actions
    setIssuesFilters: (filters: DashboardState["issuesFilters"]) => void;

    // Favourite actions
    toggleFavouriteRepo: (id: number) => void;
    toggleFavouriteIssue: (id: number) => void;
    setFavouriteRepos: (ids: Set<number>) => void;
    setFavouriteIssues: (ids: Set<number>) => void;

    // Settings actions
    setSelectedLanguages: (languages: string[]) => void;
    setDifficulty: (difficulty: number) => void;

    // Loading actions
    setLoading: (loading: boolean) => void;
    setSavingSettings: (saving: boolean) => void;
    setScanningGitHub: (scanning: boolean) => void;

    // Bulk update (for agent)
    // skipSync: set to true when update is FROM the agent (to prevent echo loop)
    updateDashboardState: (
        updates: Partial<DashboardState>,
        skipSync?: boolean
    ) => void;

    // Agent connection (for syncing state back to agent)
    setAgentConnection: (connection: WebSocket | null) => void;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(
    undefined
);

export function DashboardProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<DashboardState>({
        activeTab: "overview",
        repos: [],
        issues: [],
        selectedIssue: null,
        selectedRepo: null,
        reposPage: 1,
        issuesPage: 1,
        reposTotalPages: 1,
        issuesTotalPages: 1,
        favouriteRepos: new Set(),
        favouriteIssues: new Set(),
        selectedLanguages: [],
        difficulty: 3,
        loading: false,
        savingSettings: false,
        scanningGitHub: false,
        issuesFilters: {},
    });

    // Store agent connection for syncing state back
    const agentConnectionRef = useRef<WebSocket | null>(null);

    // Helper to sync state changes back to agent
    const syncToAgent = (updates: Partial<DashboardState>) => {
        if (
            agentConnectionRef.current &&
            agentConnectionRef.current.readyState === WebSocket.OPEN
        ) {
            agentConnectionRef.current.send(
                JSON.stringify({
                    type: "dashboard_state_update",
                    updates,
                })
            );
            console.log("[DashboardContext] Synced state to agent:", updates);
        }
    };

    // Navigation
    const setActiveTab = (tab: DashboardTab) => {
        setState((prev) => ({ ...prev, activeTab: tab }));
    };

    // Content
    const setRepos = (repos: Repo[]) => {
        setState((prev) => ({ ...prev, repos }));
    };

    const setIssues = (issues: Issue[]) => {
        setState((prev) => ({ ...prev, issues }));
    };

    const setSelectedIssue = (issue: Issue | null) => {
        setState((prev) => ({ ...prev, selectedIssue: issue }));
    };

    const setSelectedRepo = (repo: string | null) => {
        setState((prev) => ({ ...prev, selectedRepo: repo }));
    };

    // Pagination
    const setReposPage = (page: number) => {
        setState((prev) => ({ ...prev, reposPage: page }));
    };

    const setIssuesPage = (page: number) => {
        setState((prev) => ({ ...prev, issuesPage: page }));
    };

    const setReposTotalPages = (pages: number) => {
        setState((prev) => ({ ...prev, reposTotalPages: pages }));
    };

    const setIssuesTotalPages = (pages: number) => {
        setState((prev) => ({ ...prev, issuesTotalPages: pages }));
    };

    // Filters
    const setIssuesFilters = (filters: DashboardState["issuesFilters"]) => {
        setState((prev) => ({ ...prev, issuesFilters: filters }));
        // Sync filter changes back to agent so it persists correctly
        syncToAgent({ issuesFilters: filters });
    };

    // Favourites
    const toggleFavouriteRepo = (id: number) => {
        setState((prev) => {
            const newSet = new Set(prev.favouriteRepos);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return { ...prev, favouriteRepos: newSet };
        });
    };

    const toggleFavouriteIssue = (id: number) => {
        setState((prev) => {
            const newSet = new Set(prev.favouriteIssues);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return { ...prev, favouriteIssues: newSet };
        });
    };

    const setFavouriteRepos = (ids: Set<number>) => {
        setState((prev) => ({ ...prev, favouriteRepos: ids }));
    };

    const setFavouriteIssues = (ids: Set<number>) => {
        setState((prev) => ({ ...prev, favouriteIssues: ids }));
    };

    // Settings
    const setSelectedLanguages = (languages: string[]) => {
        setState((prev) => ({ ...prev, selectedLanguages: languages }));
    };

    const setDifficulty = (difficulty: number) => {
        setState((prev) => ({ ...prev, difficulty }));
    };

    // Loading
    const setLoading = (loading: boolean) => {
        setState((prev) => ({ ...prev, loading }));
    };

    const setSavingSettings = (saving: boolean) => {
        setState((prev) => ({ ...prev, savingSettings: saving }));
    };

    const setScanningGitHub = (scanning: boolean) => {
        setState((prev) => ({ ...prev, scanningGitHub: scanning }));
    };

    // Bulk update for agent
    // skipSync: set to true when update is FROM the agent (to prevent echo loop)
    const updateDashboardState = (
        updates: Partial<DashboardState>,
        skipSync = false
    ) => {
        console.log(
            "[DashboardContext] Updating dashboard state:",
            updates,
            "skipSync:",
            skipSync
        );
        setState((prev) => {
            const newState = { ...prev, ...updates };

            // Special handling for issuesFilters: merge properties instead of replacing
            if (updates.issuesFilters !== undefined) {
                newState.issuesFilters = {
                    ...prev.issuesFilters,
                    ...updates.issuesFilters,
                };

                // Remove properties that are explicitly set to undefined
                Object.keys(newState.issuesFilters).forEach((key) => {
                    if (
                        newState.issuesFilters[
                            key as keyof typeof newState.issuesFilters
                        ] === undefined
                    ) {
                        delete newState.issuesFilters[
                            key as keyof typeof newState.issuesFilters
                        ];
                    }
                });
            }

            return newState;
        });

        // Only sync to agent if this update is FROM the UI (not from the agent)
        if (!skipSync) {
            syncToAgent(updates);
        }
    };

    // Set agent connection for state syncing
    const setAgentConnection = (connection: WebSocket | null) => {
        agentConnectionRef.current = connection;
        console.log("[DashboardContext] Agent connection set:", !!connection);
    };

    return (
        <DashboardContext.Provider
            value={{
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
                toggleFavouriteRepo,
                toggleFavouriteIssue,
                setFavouriteRepos,
                setFavouriteIssues,
                setSelectedLanguages,
                setDifficulty,
                setLoading,
                setSavingSettings,
                setScanningGitHub,
                updateDashboardState,
                setAgentConnection,
            }}
        >
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard() {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error("useDashboard must be used within a DashboardProvider");
    }
    return context;
}
