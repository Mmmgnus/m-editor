import { Octokit } from '@octokit/rest';

export type FileChange = { path: string; content: string };

export async function createBranchAndPR(params: {
	owner: string;
	repo: string;
	base: string; // default branch
	branch: string; // desired new branch name
	title: string;
	body: string;
	changes: FileChange[]; // text files only; binary not supported yet
	token: string;
}): Promise<{ url: string; number: number; head: string }> {
	const { owner, repo, base, branch, title, body, changes, token } = params;
	if (!changes.length) throw new Error('No file changes provided');
	const octokit = new Octokit({ auth: token });

	// 1) Resolve base ref and tree
	let baseSha: string;
	try {
		const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${base}` });
		baseSha = baseRef.data.object.sha;
	} catch (e: unknown) {
		const status = (e as any)?.status;
		if (status === 404) {
			throw new Error(
				`Base branch '${base}' not found. Ensure the repository has an initial commit on '${base}' and try again.`
			);
		}
		if (status === 409) {
			throw new Error(
				`Repository is empty. Create an initial commit on the default branch (e.g., add a README) before creating a PR.`
			);
		}
		throw e as Error;
	}
	const baseCommit = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
	const baseTreeSha = baseCommit.data.tree.sha;

	// 2) Create a tree with our changes (text content)
	const tree = changes.map((c) => ({
		path: c.path,
		mode: '100644' as const,
		type: 'blob' as const,
		content: c.content
	}));
	const newTree = await octokit.git.createTree({ owner, repo, tree, base_tree: baseTreeSha });

	// 3) Create commit on top of base
	const commit = await octokit.git.createCommit({
		owner,
		repo,
		message: body ? `${title}\n\n${body}` : title,
		tree: newTree.data.sha,
		parents: [baseSha]
	});

	// 4) Create a new branch ref (ensure uniqueness)
	const uniqueBranch = await ensureUniqueBranch(octokit, owner, repo, branch);
	await octokit.git.createRef({ owner, repo, ref: `refs/heads/${uniqueBranch}`, sha: commit.data.sha });

	// 5) Open PR
	const pr = await octokit.pulls.create({ owner, repo, head: uniqueBranch, base, title, body });
	return { url: pr.data.html_url, number: pr.data.number, head: uniqueBranch };
}

async function ensureUniqueBranch(
	octokit: Octokit,
	owner: string,
	repo: string,
	branch: string
): Promise<string> {
	let candidate = branch;
	let n = 0;
	while (true) {
		try {
			await octokit.git.getRef({ owner, repo, ref: `heads/${candidate}` });
			// exists → try next
			n += 1;
			candidate = `${branch}-${n}`;
			continue;
		} catch (e: unknown) {
			// Not found → usable
			return candidate;
		}
	}
}

export async function commitToExistingBranch(params: {
	owner: string;
	repo: string;
	branch: string; // existing branch name
	message: string;
	changes: FileChange[];
	token: string;
}): Promise<{ commitUrl: string; sha: string }> {
	const { owner, repo, branch, message, changes, token } = params;
	if (!changes.length) throw new Error('No file changes provided');
	const octokit = new Octokit({ auth: token });

	// Get current head for branch
	const headRef = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
	const headSha = headRef.data.object.sha;
	const headCommit = await octokit.git.getCommit({ owner, repo, commit_sha: headSha });
	const baseTreeSha = headCommit.data.tree.sha;

	// Create tree with new content
	const tree = changes.map((c) => ({
		path: c.path,
		mode: '100644' as const,
		type: 'blob' as const,
		content: c.content
	}));
	const newTree = await octokit.git.createTree({ owner, repo, tree, base_tree: baseTreeSha });

	// Create commit
	const commit = await octokit.git.createCommit({
		owner,
		repo,
		message,
		tree: newTree.data.sha,
		parents: [headSha]
	});

	// Update ref to new commit
	await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.data.sha });
	return { commitUrl: commit.data.html_url ?? '', sha: commit.data.sha };
}

export async function listOpenPRs(params: {
	owner: string;
	repo: string;
	token: string;
	perPage?: number;
}): Promise<Array<{ number: number; title: string; head: { ref: string; sha: string }; url: string }>> {
	const { owner, repo, token, perPage = 20 } = params;
	const octokit = new Octokit({ auth: token });
	const res = await octokit.pulls.list({ owner, repo, state: 'open', per_page: perPage });
	return res.data.map((pr) => ({
		number: pr.number,
		title: pr.title,
		head: { ref: pr.head.ref, sha: pr.head.sha },
		url: pr.html_url
	}));
}

export async function getPRDetails(params: {
	owner: string;
	repo: string;
	number: number;
	token: string;
}): Promise<{ number: number; title: string; head: { ref: string; sha: string }; url: string }> {
	const { owner, repo, number, token } = params;
	const octokit = new Octokit({ auth: token });
	const pr = await octokit.pulls.get({ owner, repo, pull_number: number });
	return {
		number: pr.data.number,
		title: pr.data.title,
		head: { ref: pr.data.head.ref, sha: pr.data.head.sha },
		url: pr.data.html_url
	};
}

export async function getFileContentAtRef(params: {
	owner: string;
	repo: string;
	path: string;
	ref: string; // branch or sha
	token: string;
}): Promise<string> {
	const { owner, repo, path, ref, token } = params;
	const octokit = new Octokit({ auth: token });
	const res = await octokit.repos.getContent({ owner, repo, path, ref });
	// @ts-expect-error: types for getContent union
	const data = res.data;
	if (Array.isArray(data) || data.type !== 'file') {
		throw new Error('Path is not a file');
	}
	const encoding = data.encoding as string;
	if (encoding === 'base64') {
		const decoded = typeof atob === 'function' ? atob(data.content) : Buffer.from(data.content, 'base64').toString('utf8');
		return decoded;
	}
	return String(data.content ?? '');
}

export async function listChangeRequestFiles(params: {
  owner: string;
  repo: string;
  number: number;
  token: string;
}): Promise<string[]> {
  const { owner, repo, number, token } = params;
  const octokit = new Octokit({ auth: token });
  const res = await octokit.pulls.listFiles({ owner, repo, pull_number: number, per_page: 100 });
  return res.data.map((f) => f.filename);
}

export async function compareBranchToBase(params: {
  owner: string;
  repo: string;
  base: string;
  head: string;
  token: string;
}): Promise<string[]> {
  const { owner, repo, base, head, token } = params;
  const octokit = new Octokit({ auth: token });
  const res = await octokit.repos.compareCommits({ owner, repo, base, head });
  return (res.data.files || []).map((f) => f.filename as string);
}

export async function createBranchFromBase(params: {
  owner: string;
  repo: string;
  base: string; // base branch name
  branch: string; // new branch name
  token: string;
}): Promise<{ branch: string; sha: string }> {
  const { owner, repo, base, branch, token } = params;
  const octokit = new Octokit({ auth: token });
  const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${base}` });
  const baseSha = baseRef.data.object.sha;
  await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: baseSha });
  return { branch, sha: baseSha };
}

// Change Request naming aliases (wrappers)
export async function createChangeRequest(params: Parameters<typeof createBranchAndPR>[0]) {
  return createBranchAndPR(params);
}

export async function listOpenChangeRequests(params: Parameters<typeof listOpenPRs>[0]) {
  return listOpenPRs(params);
}

export async function getChangeRequestDetails(params: Parameters<typeof getPRDetails>[0]) {
  return getPRDetails(params);
}

export async function openChangeRequestForBranch(params: Parameters<typeof openPRForBranch>[0]) {
  return openPRForBranch(params);
}

export async function findChangeRequestForBranch(params: Parameters<typeof findPRForBranch>[0]) {
  return findPRForBranch(params);
}

export async function listBranches(params: {
	owner: string;
	repo: string;
	token: string;
	perPage?: number;
}): Promise<Array<{ name: string }>> {
	const { owner, repo, token, perPage = 50 } = params;
	const octokit = new Octokit({ auth: token });
	const res = await octokit.repos.listBranches({ owner, repo, per_page: perPage });
	return res.data.map((b) => ({ name: b.name }));
}

export async function openPRForBranch(params: {
	owner: string;
	repo: string;
	head: string; // branch name
	base: string;
	title: string;
	body?: string;
	token: string;
}): Promise<{ url: string; number: number }> {
	const { owner, repo, head, base, title, body, token } = params;
	const octokit = new Octokit({ auth: token });
	const pr = await octokit.pulls.create({ owner, repo, head, base, title, body });
	return { url: pr.data.html_url, number: pr.data.number };
}

export async function findPRForBranch(params: {
	owner: string;
	repo: string;
	head: string; // owner:branch or branch
	token: string;
}): Promise<{ url: string; number: number } | null> {
	const { owner, repo, head, token } = params;
	const octokit = new Octokit({ auth: token });
	const res = await octokit.pulls.list({ owner, repo, state: 'open', head: `${owner}:${head}` });
	const pr = res.data[0];
	return pr ? { url: pr.html_url, number: pr.number } : null;
}
