import React from 'react';
import { Editor } from '@modules/editor/editor';
import { Preview } from '@modules/preview/preview';
import { AuthProvider, useAuth } from '@modules/auth/auth-context';
import { Login } from '@modules/auth/login';
import { commitToExistingBranch, createBranchAndPR, getPRDetails, getFileContentAtRef, listOpenPRs, listBranches, openPRForBranch, findPRForBranch } from '@modules/pr/github-pr';
import { listRepoPathsForRef } from '@modules/repo/tree';
import { FileTree } from '@modules/repo/file-tree';
import { loadConfig, type MEditorConfig } from '@modules/repo/config';
import { parseFrontmatter } from '@modules/preview/renderer';
import { useDraft } from '@modules/storage/use-draft';
import { listDrafts, clearDraft as clearDraftKey, type DraftRecord } from '@modules/storage/drafts';
import { uploadBinaryToBranch } from '@modules/assets/upload';

function Shell(): JSX.Element {
	const { status, user, token, signOut } = useAuth();
	const [markdown, setMarkdown] = React.useState<string>(
		'---\ntitle: New Post\ndate: 2025-01-01\ntags: []\ndraft: true\n---\n\n# Hello Eleventy\n'
	);
	const [prState, setPrState] = React.useState<
		{ status: 'idle' | 'loading' | 'success' | 'error'; url?: string; message?: string }
	>({ status: 'idle' });

	const [cfg, setCfg] = React.useState<MEditorConfig | null>(null);
	const [activePR, setActivePR] = React.useState<{ number: number | null; branch: string; url: string } | null>(null);
	const [activePath, setActivePath] = React.useState<string | null>(null);
	const [picker, setPicker] = React.useState<null | 'pr' | 'branch' | 'file' | 'drafts'>(null);
	const [items, setItems] = React.useState<Array<any>>([]);
	const [currentRef, setCurrentRef] = React.useState<string | null>(null);
	const [treePaths, setTreePaths] = React.useState<string[]>([]);
	const [sidebarFilter, setSidebarFilter] = React.useState<string>('');
	const [prFilter, setPrFilter] = React.useState<string>('');
	const [branchFilter, setBranchFilter] = React.useState<string>('');
	const [newFileOpen, setNewFileOpen] = React.useState<boolean>(false);
	const [newFilePath, setNewFilePath] = React.useState<string>('');
  const [drafts, setDrafts] = React.useState<DraftRecord[]>([]);
  const [draftsFilter, setDraftsFilter] = React.useState<string>('');
  const [imageOpen, setImageOpen] = React.useState<boolean>(false);
  const [imageAlt, setImageAlt] = React.useState<string>('');
  const [imagePath, setImagePath] = React.useState<string>('');
  const imageFileRef = React.useRef<HTMLInputElement | null>(null);
  const editorRef = React.useRef<import('@modules/editor/editor').EditorHandle | null>(null);

	const draftKey = React.useMemo(() => {
		if (!cfg?.repo?.owner || !cfg?.repo?.repo || !activePR?.branch || !activePath) return null;
		return {
			owner: cfg.repo.owner,
			repo: cfg.repo.repo,
			branch: activePR.branch,
			path: activePath
		};
	}, [cfg?.repo?.owner, cfg?.repo?.repo, activePR?.branch, activePath]);

	const { status: draftStatus, undoRestore, clear: clearDraft } = useDraft({
		enabled: Boolean(draftKey),
		key: draftKey,
		markdown,
		setMarkdown
	});

	React.useEffect(() => {
		void (async () => {
			const c = await loadConfig();
			setCfg(c);
		})();
	}, []);

	// Load initial tree for default branch if none selected yet
	React.useEffect(() => {
		if (!token || !cfg?.repo?.owner || !cfg?.repo?.repo) return;
		const ref = activePR?.branch || currentRef || (cfg.repo.defaultBranch ?? cfg.defaultBranch ?? 'main');
		if (!currentRef) setCurrentRef(ref);
		void (async () => {
			try {
				const paths = await listRepoPathsForRef({ owner: cfg.repo!.owner!, repo: cfg.repo!.repo!, ref, token });
				setTreePaths(paths);
			} catch {
				// ignore for now
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cfg?.repo?.owner, cfg?.repo?.repo, token]);

	const defaults = React.useMemo(() => {
		const contentDir = cfg?.contentDirs?.[0] ?? 'src/content';
		const defaultBranch = cfg?.repo?.defaultBranch ?? cfg?.defaultBranch ?? 'main';
		const branchPrefix = cfg?.repo?.prBranchPrefix ?? 'content/';
		const pathTemplate = cfg?.repo?.postPathTemplate ?? '{contentDir}/{date}-{slug}.md';
		const prTitleTemplate = cfg?.repo?.prTitleTemplate ?? 'Add post: {title} ({path})';
		return { contentDir, defaultBranch, branchPrefix, pathTemplate, prTitleTemplate };
	}, [cfg]);

	function guessTitle(): string {
		const { data } = parseFrontmatter(markdown);
		const fmTitle = typeof data.title === 'string' ? (data.title as string) : null;
		return fmTitle || (markdown.match(/^#\s+(.+)$/m)?.[1] ?? 'New Post');
	}

	function slugify(s: string): string {
		return s
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.trim()
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-');
	}

	function getDate(): string {
		const { data } = parseFrontmatter(markdown);
		const d = typeof data.date === 'string' ? (data.date as string) : null;
		if (d) return d.substring(0, 10);
		const now = new Date();
		const y = now.getFullYear();
		const m = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	function renderTemplate(tpl: string, vars: Record<string, string>): string {
		return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
	}

  function defaultNewFilePath(): string {
    const inferredTitle = guessTitle();
    const slug = slugify(inferredTitle);
    const date = getDate();
    const contentDir = defaults.contentDir;
    return renderTemplate(defaults.pathTemplate, { contentDir, date, slug });
  }

  function defaultImagePath(fileName: string): string {
    const assetsDir = cfg?.assetsDir ?? 'src/assets';
    const date = getDate();
    const y = date.slice(0, 4);
    const m = date.slice(5, 7);
    return `${assetsDir}/${y}/${m}/${fileName}`;
  }

	async function onCreatePR(): Promise<void> {
		if (!token) return;
		setPrState({ status: 'loading' });
		const owner = cfg?.repo?.owner;
		const repo = cfg?.repo?.repo;
		if (!owner || !repo) {
			setPrState({ status: 'error', message: 'Missing repo.owner or repo.repo in .meditor.config.json' });
			return;
		}
		const base = defaults.defaultBranch;
		const inferredTitle = guessTitle();
		const slug = slugify(inferredTitle);
		const date = getDate();
		const contentDir = defaults.contentDir;
		const path = renderTemplate(defaults.pathTemplate, { contentDir, date, slug });
		const branch = `${defaults.branchPrefix}${slug}`;
		const title = renderTemplate(defaults.prTitleTemplate, { title: inferredTitle, path, branch });
		const body = `Created from the PWA editor\n\n- File: ${path}\n- Branch: ${branch}`;
		try {
			const res = await createBranchAndPR({
				owner,
				repo,
				base,
				branch,
				title,
				body,
				changes: [{ path, content: markdown }],
				token
			});
			if (res.url) {
				setPrState({ status: 'success', url: res.url });
				setActivePR({ number: null, branch, url: res.url });
				setActivePath(path);
			}
		} catch (e) {
			setPrState({ status: 'error', message: (e as Error).message });
		}
	}

	async function onOpenPR(): Promise<void> {
		if (!token) return;
		const owner = cfg?.repo?.owner;
		const repo = cfg?.repo?.repo;
		if (!owner || !repo) {
			setPrState({ status: 'error', message: 'Missing repo.owner or repo.repo in .meditor.config.json' });
			return;
		}
		const input = window.prompt('Enter PR number to open');
		const number = input ? Number(input) : NaN;
		if (!number || Number.isNaN(number)) return;
		setPrState({ status: 'loading' });
		try {
			const pr = await getPRDetails({ owner, repo, number, token });
			let path = activePath ?? window.prompt('Path to edit for this PR (e.g., src/content/hello.md)')?.trim() ?? null;
			if (!path) {
				setPrState({ status: 'error', message: 'No file path provided' });
				return;
			}
			const content = await getFileContentAtRef({ owner, repo, path, ref: pr.head.ref, token });
			setMarkdown(content);
			setActivePR({ number: pr.number, branch: pr.head.ref, url: pr.url });
			setActivePath(path);
			setPrState({ status: 'idle' });
		} catch (e) {
			setPrState({ status: 'error', message: (e as Error).message });
		}
	}

	async function onUpdatePR(): Promise<void> {
		if (!token || !activePR || !activePath) return;
		const owner = cfg?.repo?.owner!;
		const repo = cfg?.repo?.repo!;
		setPrState({ status: 'loading' });
		try {
			await commitToExistingBranch({
				owner,
				repo,
				branch: activePR.branch,
				message: `chore: update ${activePath}`,
				changes: [{ path: activePath, content: markdown }],
				token
			});
			setPrState({ status: 'success', url: activePR.url });
		} catch (e) {
			setPrState({ status: 'error', message: (e as Error).message });
		}
	}

  function openNewFilePanel(): void {
		setNewFileOpen(true);
		setNewFilePath(defaultNewFilePath());
	}

	async function createNewFileInBranch(): Promise<void> {
		if (!token || !activePR || !newFilePath) return;
		const owner = cfg?.repo?.owner!;
		const repo = cfg?.repo?.repo!;
		setPrState({ status: 'loading' });
		try {
			await commitToExistingBranch({
				owner,
				repo,
				branch: activePR.branch,
				message: `chore: add ${newFilePath}`,
				changes: [{ path: newFilePath, content: markdown }],
				token
			});
			setActivePath(newFilePath);
			setNewFileOpen(false);
			setPrState({ status: 'success', url: activePR.url });
		} catch (e) {
			setPrState({ status: 'error', message: (e as Error).message });
		}
	}

	function usePathOnly(): void {
		if (!newFilePath) return;
		setActivePath(newFilePath);
		setNewFileOpen(false);
	}

	async function openPicker(type: 'pr' | 'branch'): Promise<void> {
		if (!token) return;
		const owner = cfg?.repo?.owner;
		const repo = cfg?.repo?.repo;
		if (!owner || !repo) {
			setPrState({ status: 'error', message: 'Missing repo.owner or repo.repo in .meditor.config.json' });
			return;
		}
		setPrState({ status: 'loading' });
		try {
			if (type === 'pr') {
    const prs = await listOpenPRs({ owner, repo, token });
				setItems(prs);
			} else {
    const branches = await listBranches({ owner, repo, token });
				setItems(branches);
			}
			setPicker(type);
			setPrState({ status: 'idle' });
		} catch (e) {
			setPrState({ status: 'error', message: (e as Error).message });
		}
	}

	async function openDrafts(): Promise<void> {
		if (!cfg?.repo?.owner || !cfg?.repo?.repo) return;
		setPrState({ status: 'loading' });
		try {
			const list = await listDrafts({ owner: cfg.repo.owner, repo: cfg.repo.repo });
			setDrafts(list);
			setPicker('drafts');
			setPrState({ status: 'idle' });
		} catch (e) {
			setPrState({ status: 'error', message: (e as Error).message });
		}
	}

	async function chooseDraft(d: DraftRecord): Promise<void> {
		setMarkdown(d.content);
		setActivePR({ number: null, branch: d.branch, url: `https://github.com/${d.owner}/${d.repo}/tree/${d.branch}` });
		setActivePath(d.path);
		setPicker(null);
	}

	async function deleteDraft(d: DraftRecord): Promise<void> {
		await clearDraftKey({ owner: d.owner, repo: d.repo, branch: d.branch, path: d.path });
		setDrafts((prev) => prev.filter((x) => !(x.owner === d.owner && x.repo === d.repo && x.branch === d.branch && x.path === d.path)));
	}

	async function changeFileForActive(): Promise<void> {
		if (!token || !activePR) return;
		const owner = cfg?.repo?.owner!;
		const repo = cfg?.repo?.repo!;
		setPrState({ status: 'loading' });
		try {
			const ref = activePR.branch;
			const paths = await listRepoPathsForRef({ owner, repo, ref, token });
			setTreePaths(paths);
			setCurrentRef(ref);
			setPicker('file');
			setPrState({ status: 'idle' });
		} catch (e) {
			setPrState({ status: 'error', message: (e as Error).message });
		}
	}

  async function choosePR(n: number): Promise<void> {
    if (!token) return;
    const owner = cfg?.repo?.owner!;
    const repo = cfg?.repo?.repo!;
    setPrState({ status: 'loading' });
    try {
      const pr = await getPRDetails({ owner, repo, number: n, token });
      setActivePR({ number: pr.number, branch: pr.head.ref, url: pr.url });
      setCurrentRef(pr.head.ref);
      const paths = await listRepoPathsForRef({ owner, repo, ref: pr.head.ref, token });
      setTreePaths(paths);
      setPicker('file');
      setPrState({ status: 'idle' });
    } catch (e) {
      setPrState({ status: 'error', message: (e as Error).message });
    }
  }

  function openImagePanel(): void {
    if (!activePR) {
      setPrState({ status: 'error', message: 'Pick a PR or branch first to upload images.' });
      return;
    }
    setImageAlt(guessTitle());
    setImagePath('');
    setImageOpen(true);
  }

  async function onImageFileSelected(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageAlt(file.name.replace(/\.[^.]+$/, ''));
    setImagePath(defaultImagePath(file.name));
  }

  async function uploadAndInsertImage(): Promise<void> {
    if (!token || !activePR || !imagePath) return;
    const owner = cfg?.repo?.owner!;
    const repo = cfg?.repo?.repo!;
    const file = imageFileRef.current?.files?.[0];
    if (!file) {
      setPrState({ status: 'error', message: 'Choose an image file first.' });
      return;
    }
    setPrState({ status: 'loading' });
    try {
      await uploadBinaryToBranch({ owner, repo, branch: activePR.branch, path: imagePath, file, token, message: `chore: add image ${imagePath}` });
      // Insert markdown
      const alt = imageAlt || file.name;
      const markdownLink = `![${alt}](${imagePath})`;
      editorRef.current?.insertTextAtCursor(markdownLink);
      setImageOpen(false);
      setPrState({ status: 'success', url: activePR.url });
    } catch (e) {
      setPrState({ status: 'error', message: (e as Error).message });
    }
  }

  async function chooseBranch(branch: string): Promise<void> {
    if (!token) return;
    const owner = cfg?.repo?.owner!;
    const repo = cfg?.repo?.repo!;
    setPrState({ status: 'loading' });
    try {
      setActivePR({ number: null, branch, url: `https://github.com/${owner}/${repo}/tree/${branch}` });
      setCurrentRef(branch);
      const paths = await listRepoPathsForRef({ owner, repo, ref: branch, token });
      setTreePaths(paths);
      setPicker('file');
      setPrState({ status: 'idle' });
    } catch (e) {
      setPrState({ status: 'error', message: (e as Error).message });
    }
  }

  async function chooseFile(path: string): Promise<void> {
    if (!token || !currentRef) return;
    const owner = cfg?.repo?.owner!;
    const repo = cfg?.repo?.repo!;
    setPrState({ status: 'loading' });
    try {
      const content = await getFileContentAtRef({ owner, repo, path, ref: currentRef, token });
      setMarkdown(content);
      setActivePath(path);
      setPicker(null);
      setPrState({ status: 'idle' });
    } catch (e) {
      setPrState({ status: 'error', message: (e as Error).message });
    }
  }

	async function chooseFileFromSidebar(path: string): Promise<void> {
		const ref = activePR?.branch || currentRef || defaults.defaultBranch;
		if (!token || !ref) return;
		const owner = cfg?.repo?.owner!;
		const repo = cfg?.repo?.repo!;
		setPrState({ status: 'loading' });
		try {
			const content = await getFileContentAtRef({ owner, repo, path, ref, token });
			setMarkdown(content);
			setActivePath(path);
			if (!activePR) setActivePR({ number: null, branch: ref, url: `https://github.com/${owner}/${repo}/tree/${ref}` });
			setPrState({ status: 'idle' });
		} catch (e) {
			setPrState({ status: 'error', message: (e as Error).message });
		}
	}

	async function refreshSidebarTree(): Promise<void> {
		if (!token || !cfg?.repo?.owner || !cfg?.repo?.repo) return;
		const ref = activePR?.branch || currentRef || defaults.defaultBranch;
		if (!ref) return;
		setPrState({ status: 'loading' });
		try {
			const paths = await listRepoPathsForRef({ owner: cfg.repo!.owner!, repo: cfg.repo!.repo!, ref, token });
			setTreePaths(paths);
			setPrState({ status: 'idle' });
		} catch (e) {
			setPrState({ status: 'error', message: (e as Error).message });
		}
	}
	async function createOrOpenPRFromBranch(): Promise<void> {
		if (!token || !activePR) return;
		const owner = cfg?.repo?.owner!;
		const repo = cfg?.repo?.repo!;
		const base = defaults.defaultBranch;
		setPrState({ status: 'loading' });
		try {
			const existing = await findPRForBranch({ owner, repo, head: activePR.branch, token });
			if (existing) {
				setActivePR({ number: existing.number, branch: activePR.branch, url: existing.url });
				setPrState({ status: 'success', url: existing.url });
				return;
			}
			const title = `Content updates for ${activePR.branch}`;
			const body = activePath ? `Updates to ${activePath}` : undefined;
			const pr = await openPRForBranch({ owner, repo, head: activePR.branch, base, title, body, token });
			setActivePR({ number: pr.number, branch: activePR.branch, url: pr.url });
			setPrState({ status: 'success', url: pr.url });
		} catch (e) {
			setPrState({ status: 'error', message: (e as Error).message });
		}
	}
	if (status !== 'authed') {
		return <Login />;
	}
	return (
		<div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 1fr', height: '100vh' }}>
			<aside style={{ borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' }}>
				<div style={{ padding: '8px 12px', borderBottom: '1px solid #e0e0e0' }}>
					<strong>Documents</strong>
					<div style={{ fontSize: 12, color: '#666' }}>Branch: {activePR?.branch || currentRef || defaults.defaultBranch}</div>
					<div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
						<input type="text" placeholder="Filter files…" value={sidebarFilter} onChange={(e) => setSidebarFilter(e.target.value)} style={{ flex: 1, padding: 6 }} />
						<button onClick={() => void refreshSidebarTree()}>Refresh</button>
					</div>
				</div>
				<div style={{ flex: 1, overflow: 'auto' }}>
					<FileTree
						paths={treePaths.filter((p) => (sidebarFilter ? p.toLowerCase().includes(sidebarFilter.toLowerCase()) : true))}
						roots={cfg?.contentDirs}
						onSelect={(p) => void chooseFileFromSidebar(p)}
					/>
				</div>
			</aside>
			<section style={{ borderRight: '1px solid #e0e0e0' }}>
				<header style={{ padding: '8px 12px' }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<strong>M Editor</strong>
						<span>
							{user?.login}
							<button style={{ marginLeft: 8 }} onClick={signOut}>Sign out</button>
						</span>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
						<button onClick={onCreatePR} disabled={prState.status === 'loading'}>
							{prState.status === 'loading' ? 'Creating PR…' : 'Create PR'}
						</button>
						<button onClick={() => openPicker('pr')} disabled={prState.status === 'loading'}>
							Pick PR
						</button>
						<button onClick={() => openPicker('branch')} disabled={prState.status === 'loading'}>
							Pick Branch
						</button>
						<button onClick={openDrafts} disabled={prState.status === 'loading'}>
							Drafts
						</button>
                {activePR ? (
                  <button onClick={onUpdatePR} disabled={prState.status === 'loading'}>
                    Update PR
                  </button>
                ) : null}
                {activePR ? (
                  <button onClick={createOrOpenPRFromBranch} disabled={prState.status === 'loading'}>
                    Open/Create PR for Branch
                  </button>
                ) : null}
                {activePR ? (
                  <button onClick={changeFileForActive} disabled={prState.status === 'loading'}>
                    Change file…
                  </button>
                ) : null}
                {activePR ? (
                  <button onClick={openImagePanel} disabled={prState.status === 'loading'}>
                    Insert image…
                  </button>
                ) : null}
						{activePR ? (
							<button onClick={openNewFilePanel} disabled={prState.status === 'loading'}>
								New file…
							</button>
						) : null}
					</div>
				</header>
				{activePR ? (
					<div style={{ background: '#e7f3ff', color: '#054289', padding: '6px 12px' }}>
						Working on PR #{activePR.number ?? 'new'} — Branch: {activePR.branch}
						{activePath ? ` — File: ${activePath}` : ''} —
						<a href={activePR.url} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }}>Open</a>
					</div>
				) : null}
				{draftKey && draftStatus.mode === 'restored' && (
					<div style={{ background: '#fff8e1', color: '#7a4b00', padding: '6px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
						Restored local draft for {draftKey.path}.
						<button onClick={undoRestore}>Undo</button>
						<button onClick={() => void clearDraft()}>Clear draft</button>
					</div>
				)}
				{draftKey && draftStatus.mode !== 'restored' && draftStatus.savedAt && (
					<div style={{ background: '#f5f5f5', color: '#333', padding: '4px 12px', fontSize: 12 }}>
						Draft saved {new Date(draftStatus.savedAt).toLocaleTimeString()}
					</div>
				)}
				{picker && picker !== 'file' && picker !== 'drafts' && (
					<div style={{ padding: '8px 12px', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
						<strong>{picker === 'pr' ? 'Open PR' : 'Open Branch'}</strong>
						{picker === 'pr' ? (
							<input type="text" placeholder="Filter PRs…" value={prFilter} onChange={(e) => setPrFilter(e.target.value)} style={{ padding: 4, minWidth: 240 }} />
						) : (
							<input type="text" placeholder="Filter branches…" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={{ padding: 4, minWidth: 240 }} />
						)}
						<button onClick={() => setPicker(null)} style={{ marginLeft: 'auto' }}>Close</button>
					</div>
				)}
        {picker === 'pr' && (
          <div style={{ maxHeight: 220, overflow: 'auto', borderBottom: '1px solid #e0e0e0' }}>
            {items
              .filter((pr: any) => (prFilter ? (pr.title as string).toLowerCase().includes(prFilter.toLowerCase()) || String(pr.number).includes(prFilter) : true))
              .map((pr: any) => (
                <div key={pr.number} style={{ padding: '6px 12px', cursor: 'pointer' }} onClick={() => void choosePR(pr.number)}>
                  #{pr.number} — {pr.title}
                </div>
              ))}
            {items.length === 0 && <div style={{ padding: '6px 12px', color: '#666' }}>No open PRs</div>}
          </div>
        )}
        {picker === 'branch' && (
          <div style={{ maxHeight: 220, overflow: 'auto', borderBottom: '1px solid #e0e0e0' }}>
            {items
              .filter((b: any) => (branchFilter ? (b.name as string).toLowerCase().includes(branchFilter.toLowerCase()) : true))
              .map((b: any) => (
                <div key={b.name} style={{ padding: '6px 12px', cursor: 'pointer' }} onClick={() => void chooseBranch(b.name)}>
                  {b.name}
                </div>
              ))}
            {items.length === 0 && <div style={{ padding: '6px 12px', color: '#666' }}>No branches found</div>}
          </div>
        )}
        {picker === 'file' && (
          <div style={{ borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <strong>Pick File</strong>
              <button onClick={() => setPicker(null)} style={{ marginLeft: 'auto' }}>Close</button>
            </div>
            <FileTree
              paths={treePaths}
              roots={cfg?.contentDirs}
              onSelect={(p) => void chooseFile(p)}
            />
          </div>
        )}
        {imageOpen && (
          <div style={{ borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <strong>Insert Image</strong>
              <input ref={imageFileRef} type="file" accept="image/*" onChange={onImageFileSelected} />
              <input type="text" placeholder="Alt text" value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} style={{ padding: 6, minWidth: 160 }} />
              <input type="text" placeholder="Repo path (e.g., src/assets/2025/01/hero.png)" value={imagePath} onChange={(e) => setImagePath(e.target.value)} style={{ padding: 6, minWidth: 360 }} />
              <button onClick={uploadAndInsertImage} disabled={prState.status === 'loading' || !imagePath}>Upload & insert</button>
              <button onClick={() => setImageOpen(false)} style={{ marginLeft: 'auto' }}>Close</button>
            </div>
          </div>
        )}
        {picker === 'drafts' && (
          <div style={{ borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <strong>Drafts</strong>
              <input type="text" placeholder="Filter drafts…" value={draftsFilter} onChange={(e) => setDraftsFilter(e.target.value)} style={{ padding: 4, minWidth: 240 }} />
              <button onClick={() => setPicker(null)} style={{ marginLeft: 'auto' }}>Close</button>
            </div>
            <div style={{ maxHeight: 260, overflow: 'auto' }}>
              {drafts
                .filter((d) => (draftsFilter ? (`${d.branch}/${d.path}`).toLowerCase().includes(draftsFilter.toLowerCase()) : true))
                .map((d) => (
                  <div key={`${d.owner}/${d.repo}:${d.branch}:${d.path}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'ui-monospace, monospace' }}>{d.branch} — {d.path}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>Saved {new Date(d.updatedAt).toLocaleString()}</div>
                    </div>
                    <button onClick={() => void chooseDraft(d)}>Open</button>
                    <button onClick={() => void deleteDraft(d)} style={{ color: '#b50b0b' }}>Delete</button>
                  </div>
                ))}
              {drafts.length === 0 && <div style={{ padding: '8px 12px', color: '#666' }}>No drafts found</div>}
            </div>
          </div>
        )}
				{activePR && newFileOpen && (
					<div style={{ borderBottom: '1px solid #e0e0e0' }}>
						<div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
							<strong>New File in Branch</strong>
							<input
								type="text"
								placeholder="e.g., src/content/my-post.md"
								value={newFilePath}
								onChange={(e) => setNewFilePath(e.target.value)}
								style={{ padding: 6, minWidth: 320 }}
							/>
							<button onClick={createNewFileInBranch} disabled={prState.status === 'loading' || !newFilePath}>
								Create file
							</button>
							<button onClick={usePathOnly} disabled={!newFilePath}>Use path only</button>
							<button onClick={() => setNewFileOpen(false)} style={{ marginLeft: 'auto' }}>Close</button>
						</div>
					</div>
				)}
				{prState.status === 'success' && prState.url ? (
					<div style={{ background: '#e6ffed', color: '#044a14', padding: '6px 12px' }}>
						PR created: <a href={prState.url} target="_blank" rel="noreferrer">{prState.url}</a>
					</div>
				) : null}
				{prState.status === 'error' && prState.message ? (
					<div style={{ background: '#ffebe9', color: '#b50b0b', padding: '6px 12px' }}>
						Failed to create PR: {prState.message}
					</div>
				) : null}
				<Editor ref={editorRef} value={markdown} onChange={setMarkdown} />
			</section>
			<section>
				<header style={{ padding: '8px 12px' }}>
					<strong>Preview</strong>
				</header>
				<Preview
					markdown={markdown}
					repo={activePR && cfg?.repo?.owner && cfg?.repo?.repo ? { owner: cfg.repo.owner, repo: cfg.repo.repo, ref: activePR.branch, filePath: activePath ?? undefined } : undefined}
					assetsDir={cfg?.assetsDir}
				/>
			</section>
		</div>
	);
}

export function App(): JSX.Element {
	return (
		<AuthProvider>
			<Shell />
		</AuthProvider>
	);
}
