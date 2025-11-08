import { Octokit } from '@octokit/rest';

export async function listRepoPathsForRef(params: {
	owner: string;
	repo: string;
	ref: string; // branch name or commit sha
	token: string;
}): Promise<string[]> {
	const { owner, repo, ref, token } = params;
	const octokit = new Octokit({ auth: token });

	// Resolve ref to commit sha and tree sha
	let commitSha = ref;
	if (!/^[0-9a-f]{40}$/i.test(ref)) {
		const headRef = await octokit.git.getRef({ owner, repo, ref: `heads/${ref}` });
		commitSha = headRef.data.object.sha;
	}
	const commit = await octokit.git.getCommit({ owner, repo, commit_sha: commitSha });
	const treeSha = commit.data.tree.sha;
	const tree = await octokit.git.getTree({ owner, repo, tree_sha: treeSha, recursive: '1' });
	const paths: string[] = [];
	for (const item of tree.data.tree) {
		if (item.type === 'blob' && item.path) paths.push(item.path);
	}
	return paths;
}

