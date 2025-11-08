import { Octokit } from '@octokit/rest';

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // Convert ArrayBuffer to base64
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[]);
  }
  return btoa(binary);
}

export async function uploadBinaryToBranch(params: {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  file: File;
  message?: string;
  token: string;
}): Promise<{ commitSha: string; blobSha: string }> {
  const { owner, repo, branch, path, file, token } = params;
  const message = params.message ?? `chore: add ${path}`;
  const octokit = new Octokit({ auth: token });

  // Get current head
  const headRef = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const headSha = headRef.data.object.sha;
  const headCommit = await octokit.git.getCommit({ owner, repo, commit_sha: headSha });
  const baseTreeSha = headCommit.data.tree.sha;

  // Create blob
  const base64 = await fileToBase64(file);
  const blob = await octokit.git.createBlob({ owner, repo, content: base64, encoding: 'base64' });

  // Create tree entry referencing blob sha
  const tree = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: [
      {
        path,
        mode: '100644',
        type: 'blob',
        sha: blob.data.sha
      }
    ]
  });

  // Commit and update ref
  const commit = await octokit.git.createCommit({ owner, repo, message, tree: tree.data.sha, parents: [headSha] });
  await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.data.sha });
  return { commitSha: commit.data.sha, blobSha: blob.data.sha };
}

