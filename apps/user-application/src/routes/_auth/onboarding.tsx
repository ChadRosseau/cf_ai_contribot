import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Upload, Sparkles } from "lucide-react";

import { COMMON_LANGUAGES } from "@/lib/languages";

export const Route = createFileRoute("/_auth/onboarding")({
    component: OnboardingPage,
});

function OnboardingPage() {
    const navigate = useNavigate();
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
    const [difficulty, setDifficulty] = useState(3);
    const [loading, setLoading] = useState(false);
    const [scanningGitHub, setScanningGitHub] = useState(false);

    const toggleLanguage = (lang: string) => {
        setSelectedLanguages((prev) =>
            prev.includes(lang)
                ? prev.filter((l) => l !== lang)
                : [...prev, lang]
        );
    };

    const handleScanGitHub = async () => {
        setScanningGitHub(true);
        try {
            // Initialize agent
            const initResponse = await fetch("/api/agent/initialize", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!initResponse.ok) {
                const errorText = await initResponse.text();
                console.error("Init response:", errorText);
                throw new Error("Failed to initialize agent");
            }

            // Get user repositories
            const res = await fetch("/api/agent/languages", {
                headers: {
                    "Content-Type": "application/json",
                },
            });
            const data = (await res.json()) as {
                languages: string[];
            };
            console.log("Languages:", data.languages);

            for (const l of data.languages.sort()) {
                if (selectedLanguages.includes(l)) continue;
                toggleLanguage(l);
                await new Promise((res) => setTimeout(res, 50));
            }
        } catch (error) {
            console.error("Failed to scan GitHub:", error);
        } finally {
            setScanningGitHub(false);
        }
    };

    const handleContinue = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/user/preferences", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    preferredLanguages: selectedLanguages,
                    difficultyPreference: difficulty,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Preferences response:", errorText);
                throw new Error("Failed to save preferences");
            }

            navigate({ to: "/app" });
        } catch (error) {
            console.error("Failed to save preferences:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FBAD41] to-[#FF6633] flex items-center justify-center px-10">
            <div className="w-full h-full">
                <div className="text-center mb-8 text-secondary">
                    <h1 className="text-5xl font-bold mb-2">
                        Welcome to Contribot!
                    </h1>
                    <p className="">
                        Let's personalize your experience. What languages do you
                        work with, and how challenging would you like your first
                        issues to be?
                    </p>
                </div>
                <div className="grid md:grid-cols-2 h-full gap-6">
                    <div className="flex justify-center items-center relative ">
                        <CardContent>
                            <div className="flex justify-center flex-wrap gap-y-2 px-7">
                                {Array.from(
                                    new Set([
                                        ...COMMON_LANGUAGES,
                                        ...selectedLanguages,
                                    ])
                                )
                                    // .sort()
                                    .map((lang) => (
                                        <Button
                                            key={lang}
                                            variant={
                                                selectedLanguages.includes(lang)
                                                    ? "default"
                                                    : "outline"
                                            }
                                            className={`justify-start duration-500 px-5 py-2 rounded-full mr-2 cursor-pointer transition-all border-white border-1 ${
                                                selectedLanguages.includes(
                                                    lang
                                                ) && "shadow-lg -translate-y-1"
                                            }`}
                                            onClick={() => toggleLanguage(lang)}
                                        >
                                            {lang}
                                        </Button>
                                    ))}
                            </div>
                        </CardContent>
                        <p className="text-sm text-accent mt-15 absolute left-0 bottom-0">
                            {selectedLanguages.length} language
                            {selectedLanguages.length !== 1 ? "s" : ""} selected
                        </p>
                    </div>

                    <Card className="">
                        <CardHeader>
                            <CardTitle className="text-lg">
                                Quick Setup
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={handleScanGitHub}
                                disabled={scanningGitHub}
                            >
                                <Github className="mr-2 h-4 w-4" />
                                {scanningGitHub
                                    ? "Scanning..."
                                    : "Scan My GitHub"}
                            </Button>
                            <p className="text-sm text-muted-foreground">
                                We'll analyze your repositories to detect
                                languages you use
                            </p>
                        </CardContent>
                        <CardHeader>
                            <CardTitle>Difficulty Preference</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span>Beginner</span>
                                    <span className="font-semibold">
                                        Level {difficulty}
                                    </span>
                                    <span>Advanced</span>
                                </div>
                                <Slider
                                    value={[difficulty]}
                                    onValueChange={(value) =>
                                        setDifficulty(value[0])
                                    }
                                    min={1}
                                    max={5}
                                    step={1}
                                    className="w-full"
                                />
                            </div>

                            <div className="p-4 rounded-lg bg-muted min-h-18">
                                <p className="text-sm">
                                    {difficulty === 1 &&
                                        "Perfect for absolute beginners. Issues include clear instructions and minimal code changes."}
                                    {difficulty === 2 &&
                                        "Good for beginners with basic programming knowledge. Issues may require simple fixes."}
                                    {difficulty === 3 &&
                                        "Intermediate level. Some problem-solving and code reading required."}
                                    {difficulty === 4 &&
                                        "For developers comfortable with the language. May involve complex logic."}
                                    {difficulty === 5 &&
                                        "Advanced issues requiring deep understanding of the codebase."}
                                </p>
                            </div>
                        </CardContent>
                        <Button
                            onClick={handleContinue}
                            disabled={selectedLanguages.length === 0 || loading}
                            size="lg"
                            className="ml-auto mr-5"
                        >
                            {loading ? "Saving..." : "Complete Setup"}
                        </Button>
                    </Card>
                </div>
            </div>
        </div>
    );
}
