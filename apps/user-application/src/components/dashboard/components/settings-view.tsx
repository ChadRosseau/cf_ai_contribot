import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Github, Loader2 } from "lucide-react";
import { COMMON_LANGUAGES } from "@/lib/languages";

interface SettingsViewProps {
	onSave: () => void;
	onCancel: () => void;
}

export function SettingsView({ onSave, onCancel }: SettingsViewProps) {
	const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
	const [difficulty, setDifficulty] = useState<number>(3);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isScanning, setIsScanning] = useState(false);

	// Fetch current preferences from database on mount
	useEffect(() => {
		const fetchPreferences = async () => {
			setIsLoading(true);
			try {
				const response = await fetch("/api/user/preferences");
				if (response.ok) {
					const data = await response.json();
					setSelectedLanguages(data.preferredLanguages || []);
					setDifficulty(data.difficultyPreference || 3);
				}
			} catch (error) {
				console.error("Failed to fetch preferences:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchPreferences();
	}, []);

	const toggleLanguage = (lang: string) => {
		setSelectedLanguages((prev) =>
			prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
		);
	};

	const handleScanGitHub = async () => {
		setIsScanning(true);
		try {
			const res = await fetch("/api/agent/languages", {
				headers: {
					"Content-Type": "application/json",
				},
			});
			const data = (await res.json()) as {
				languages: string[];
			};

			for (const l of data.languages.sort()) {
				if (selectedLanguages.includes(l)) continue;
				toggleLanguage(l);
				await new Promise((res) => setTimeout(res, 50));
			}
		} catch (error) {
			console.error("Failed to scan GitHub:", error);
		} finally {
			setIsScanning(false);
		}
	};

	const handleSave = async () => {
		setIsSaving(true);
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
				throw new Error("Failed to save preferences");
			}

			// Call parent callback to handle post-save actions (navigate, refresh, etc.)
			onSave();
		} catch (error) {
			console.error("Failed to save settings:", error);
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-8 w-8 text-white animate-spin" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-semibold text-white mb-4">
					Language Preferences
				</h3>
				<Card className="bg-white/90 backdrop-blur-sm shadow-lg">
					<CardContent>
						<div className="flex justify-center flex-wrap gap-2">
							{Array.from(new Set([...COMMON_LANGUAGES, ...selectedLanguages]))
								.sort()
								.map((lang) => (
									<Button
										key={lang}
										variant={
											selectedLanguages.includes(lang) ? "default" : "outline"
										}
										className={`px-4 py-2 rounded-full transition-all ${
											selectedLanguages.includes(lang) && "shadow-lg"
										}`}
										onClick={() => toggleLanguage(lang)}
									>
										{lang}
									</Button>
								))}
						</div>
						<div className="flex justify-between mt-3">
							<p className="text-sm text-muted-foreground mt-4 text-center">
								{selectedLanguages.length} language
								{selectedLanguages.length !== 1 ? "s" : ""} selected
							</p>
							<Button
								variant="outline"
								className="w-fit justify-start"
								onClick={handleScanGitHub}
								disabled={isScanning}
							>
								{isScanning ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Github className="h-4 w-4" />
								)}
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			<div>
				<h3 className="text-lg font-semibold text-white mb-4">
					Difficulty Preference
				</h3>
				<Card className="bg-white/90 backdrop-blur-sm shadow-lg">
					<CardContent className="pt-6 space-y-6">
						<div className="space-y-4">
							<div className="flex justify-between text-sm">
								<span>Beginner</span>
								<span className="font-semibold">Level {difficulty}</span>
								<span>Advanced</span>
							</div>
							<Slider
								value={[difficulty]}
								onValueChange={(value) => setDifficulty(value[0])}
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
				</Card>
			</div>

			<div className="flex justify-end gap-2">
				<Button
					variant="outline"
					onClick={onCancel}
					className="bg-white/90"
					disabled={isSaving}
				>
					Cancel
				</Button>
				<Button
					onClick={handleSave}
					disabled={selectedLanguages.length === 0 || isSaving}
					size="lg"
				>
					{isSaving ? "Saving..." : "Save Preferences"}
				</Button>
			</div>
		</div>
	);
}
