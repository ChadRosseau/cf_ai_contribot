/**
 * Prompt template for generating issue analysis
 */

export function generateIssueAnalysisPrompt(
	repoName: string,
	repoOwner: string,
	issueTitle: string,
	issueBody: string | null,
): string {
	const body = issueBody || "No description provided.";

	return `You are an expert at helping beginners contribute to open-source. Analyze this GitHub issue and provide guidance.

Repository: ${repoOwner}/${repoName}
Issue Title: ${issueTitle}
Issue Description:
${body.slice(0, 1000)} ${body.length > 1000 ? "..." : ""}

Provide the following in JSON format:
{
  "intro": "2-3 sentence introduction explaining what this issue is about in simple terms",
  "difficulty": <number 1-5, scaled for beginner-friendly issues where:
    1 = Pure documentation, typos, or README updates
    2 = Simple code changes with clear instructions (add a parameter, fix a string)
    3 = Standard "good first issue" - small feature or bug fix, some code navigation needed
    4 = Multiple files, testing required, or needs understanding of a specific pattern/concept
    5 = Requires algorithmic thinking, performance optimization, or working across several components>,
  "firstSteps": "Specific actionable steps a beginner should take to start working on this issue (2-3 sentences)"
}

IMPORTANT: Use the full 1-5 scale. Distribute issues across all levels - not everything is a 3. A difficulty 5 is still beginner-appropriate, just requires more technical depth.

Response:`;
}
