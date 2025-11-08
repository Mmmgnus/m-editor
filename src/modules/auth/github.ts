// Placeholder GitHub auth functions for MVP (GitHub only)
// For SPA, consider GitHub OAuth Device Flow or a lightweight backend for PKCE.

export type GitHubAuth = {
	accessToken: string;
};

export async function loginWithGitHubDeviceFlow(_clientId: string): Promise<GitHubAuth> {
	// TODO: Implement device flow: request device code, poll for token.
	// For now, prompt for a classic token with repo scope.
	const token = window.prompt('Enter a GitHub token with repo scope');
	if (!token) throw new Error('No token provided');
	return { accessToken: token };
}

export function getAuthToken(): string | null {
	return localStorage.getItem('gh_token');
}

export function setAuthToken(token: string): void {
	localStorage.setItem('gh_token', token);
}

