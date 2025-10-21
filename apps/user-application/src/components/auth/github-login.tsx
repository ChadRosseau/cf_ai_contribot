import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export function GithubLogin() {
	const handleGithubSignIn = async () => {
		await authClient.signIn.social({
			provider: "github",
		});
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
					<CardDescription>Sign in to your account to continue</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						onClick={handleGithubSignIn}
						className="w-full h-12 text-base"
						variant="outline"
					>
						<div className="w-8 h-8 bg-[url(/github-mark.svg)] bg-no-repeat bg-cover"></div>
						Continue with Github
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
