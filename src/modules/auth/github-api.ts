import type { GitHubUser } from './types';

const API = 'https://api.github.com';

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
	const res = await fetch(`${API}/user`, {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
	});
	if (!res.ok) {
		throw new Error(`GitHub auth failed: ${res.status}`);
	}
	return (await res.json()) as GitHubUser;
}

