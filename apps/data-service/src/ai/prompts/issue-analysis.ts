/**
 * Prompt template for generating issue analysis
 */

export function generateIssueAnalysisPrompt(
	repoName: string,
	repoOwner: string,
	issueTitle: string,
	issueBody: string | null
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
  "difficulty": <number 1-5, where 1=very easy for absolute beginners, 5=requires advanced knowledge>,
  "firstSteps": "Specific actionable steps a beginner should take to start working on this issue (2-3 sentences)"
}

Focus on being encouraging and practical. Think about what a complete beginner would need to know.

Response:`;
}

