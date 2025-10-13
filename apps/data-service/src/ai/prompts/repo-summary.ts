/**
 * Prompt template for generating repository summaries
 */

export function generateRepoSummaryPrompt(
	repoName: string,
	repoOwner: string,
	languages: string[]
): string {
	return `You are an expert at analyzing open-source repositories. Generate a concise, beginner-friendly summary of the following repository.

Repository: ${repoOwner}/${repoName}
Primary Languages: ${languages.join(", ")}

Write ONE paragraph (3-5 sentences) that explains:
1. What the project does
2. Who would use it
3. Why it's interesting for beginners

Keep it simple, welcoming, and focused on what makes this project a good learning opportunity.

Summary:`;
}

