import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Upload, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_auth/onboarding")({
    component: OnboardingPage,
});

const COMMON_LANGUAGES = [
    "JavaScript",
    "TypeScript",
    "Python",
    "Java",
    "Go",
    "Rust",
    "C++",
    "C#",
    "Ruby",
    "PHP",
    "Swift",
    "Kotlin",
];

function OnboardingPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState<"languages" | "difficulty">("languages");
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

            for (const l of data.languages) {
                if (selectedLanguages.includes(l)) continue;
                toggleLanguage(l);
                await new Promise((res) => setTimeout(res, 100));
            }
        } catch (error) {
            console.error("Failed to scan GitHub:", error);
        } finally {
            setScanningGitHub(false);
        }
    };

    const handleContinue = async () => {
        if (step === "languages") {
            setStep("difficulty");
        } else {
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
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-4xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">
                        Welcome to Contribot!
                    </h1>
                    <p className="text-muted-foreground">
                        {step === "languages"
                            ? "Let's personalize your experience. What languages do you work with?"
                            : "How challenging would you like your first issues to be?"}
                    </p>
                </div>

                {step === "languages" ? (
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Select Languages
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-2">
                                        {COMMON_LANGUAGES.map((lang) => (
                                            <Button
                                                key={lang}
                                                variant={
                                                    selectedLanguages.includes(
                                                        lang
                                                    )
                                                        ? "default"
                                                        : "outline"
                                                }
                                                className="justify-start duration-500"
                                                onClick={() =>
                                                    toggleLanguage(lang)
                                                }
                                            >
                                                <Sparkles
                                                    className={`mr-2 h-4 w-4 ${
                                                        selectedLanguages.includes(
                                                            lang
                                                        )
                                                            ? "opacity-100"
                                                            : "opacity-0"
                                                    }`}
                                                />
                                                {lang}
                                            </Button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
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
                                        We'll analyze your repositories to
                                        detect languages you use
                                    </p>

                                    <div className="pt-4 border-t">
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start"
                                            disabled
                                        >
                                            <Upload className="mr-2 h-4 w-4" />
                                            Upload Resume (Coming Soon)
                                        </Button>
                                        <p className="text-sm text-muted-foreground mt-2">
                                            OCR technology will extract your
                                            skills
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">
                                {selectedLanguages.length} language
                                {selectedLanguages.length !== 1 ? "s" : ""}{" "}
                                selected
                            </p>
                            <Button
                                onClick={handleContinue}
                                disabled={selectedLanguages.length === 0}
                                size="lg"
                            >
                                Continue
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <Card>
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

                                <div className="p-4 rounded-lg bg-muted">
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
                        </Card>

                        <div className="flex justify-between">
                            <Button
                                variant="outline"
                                onClick={() => setStep("languages")}
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleContinue}
                                disabled={loading}
                                size="lg"
                            >
                                {loading ? "Saving..." : "Complete Setup"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
