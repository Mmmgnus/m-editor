import React from 'react';
import { Editor } from '@modules/editor/editor';
import { Preview } from '@modules/preview/preview';
import { AuthProvider, useAuth } from '@modules/auth/auth-context';
import { Login } from '@modules/auth/login';
import { commitToExistingBranch, createChangeRequest, getChangeRequestDetails, getFileContentAtRef, listOpenChangeRequests, listBranches, openChangeRequestForBranch, findChangeRequestForBranch, createBranchFromBase } from '@modules/change-requests/github';
import { listRepoPathsForRef } from '@modules/repo/tree';
import { FileTree } from '@modules/repo/file-tree';
import { clearLocalOverrides, loadConfig, saveLocalOverrides, type MEditorConfig } from '@modules/repo/config';
import { parseFrontmatter } from '@modules/preview/renderer';
import { useDraft } from '@modules/storage/use-draft';
import { listDrafts, clearDraft as clearDraftKey, type DraftRecord } from '@modules/storage/drafts';
import { uploadBinaryToBranch } from '@modules/assets/upload';

function Shell(): JSX.Element {
	const { status, user, token, signOut } = useAuth();
	const [markdown, setMarkdown] = React.useState<string>(
		'---\ntitle: New Post\ndate: 2025-01-01\ntags: []\ndraft: true\n---\n\n# Hello Eleventy\n'
	);
  const [crState, setCrState] = React.useState<
    { status: 'idle' | 'loading' | 'success' | 'error'; url?: string; message?: string }
  >({ status: 'idle' });

	const [cfg, setCfg] = React.useState<MEditorConfig | null>(null);
  const [activeCR, setActiveCR] = React.useState<{ number: number | null; branch: string; url: string } | null>(null);
	const [activePath, setActivePath] = React.useState<string | null>(null);
	const [picker, setPicker] = React.useState<null | 'branch' | 'file'>(null);
	const [items, setItems] = React.useState<Array<any>>([]);
	const [currentRef, setCurrentRef] = React.useState<string | null>(null);
	const [treePaths, setTreePaths] = React.useState<string[]>([]);
	const [draftPathSet, setDraftPathSet] = React.useState<Set<string>>(new Set());
	const [sidebarFilter, setSidebarFilter] = React.useState<string>('');
	const [leftTab, setLeftTab] = React.useState<'content' | 'changes' | 'local'>('content');
  const [sidebarCRs, setSidebarCRs] = React.useState<Array<{ number: number; title: string }>>([]);
  const [sidebarCRFilter, setSidebarCRFilter] = React.useState<string>('');
  async function refreshCRs(): Promise<void> {
    if (!token || !cfg?.repo?.owner || !cfg?.repo?.repo) return;
    try {
      const crs = await listOpenChangeRequests({ owner: cfg.repo.owner, repo: cfg.repo.repo, token });
      setSidebarCRs(crs.map((p) => ({ number: p.number, title: p.title })));
    } catch {
      // ignore
    }
  }

  async function switchToDefaultBranch(): Promise<void> {
    const nextRef = defaults.defaultBranch;
    setCrState({ status: 'loading' });
    try {
      // Clear active change request context
      setActiveCR(null);
      // Load same file from default branch if possible
      if (token && cfg?.repo?.owner && cfg?.repo?.repo && activePath) {
        try {
          const content = await getFileContentAtRef({ owner: cfg.repo.owner, repo: cfg.repo.repo, path: activePath, ref: nextRef, token });
          setMarkdown(content);
        } catch {
          // If file doesn't exist on default, keep current editor content
        }
      }
      setCurrentRef(nextRef);
      await refreshSidebarTree();
      setCrState({ status: 'idle' });
    } catch (e) {
      setCrState({ status: 'error', message: (e as Error).message });
    }
  }
	const [branchFilter, setBranchFilter] = React.useState<string>('');
	const [newFileOpen, setNewFileOpen] = React.useState<boolean>(false);
	const [newFilePath, setNewFilePath] = React.useState<string>('');
  const [branchDrafts, setBranchDrafts] = React.useState<DraftRecord[]>([]);
  const [defaultDrafts, setDefaultDrafts] = React.useState<DraftRecord[]>([]);
	const [imageOpen, setImageOpen] = React.useState<boolean>(false);
  const [imageAlt, setImageAlt] = React.useState<string>('');
  const [imagePath, setImagePath] = React.useState<string>('');
  const imageFileRef = React.useRef<HTMLInputElement | null>(null);
	const editorRef = React.useRef<import('@modules/editor/editor').EditorHandle | null>(null);

	// Settings panel state
	const [settingsOpen, setSettingsOpen] = React.useState<boolean>(false);
	const [sOwner, setSOwner] = React.useState<string>('');
	const [sRepo, setSRepo] = React.useState<string>('');
	const [sDefaultBranch, setSDefaultBranch] = React.useState<string>('main');
	const [sContentDirs, setSContentDirs] = React.useState<string>('src/content');
	const [sAssetsDir, setSAssetsDir] = React.useState<string>('src/assets');
	const [sPrBranchPrefix, setSPrBranchPrefix] = React.useState<string>('content/');
	const [sPostPathTemplate, setSPostPathTemplate] = React.useState<string>('{contentDir}/{date}-{slug}.md');
  const [sCrTitleTemplate, setSCrTitleTemplate] = React.useState<string>('Add post: {title} ({path})');
	const [settingsMsg, setSettingsMsg] = React.useState<string>('');

	const draftKey = React.useMemo(() => {
		if (!cfg?.repo?.owner || !cfg?.repo?.repo || !activeCR?.branch || !activePath) return null;
		return {
			owner: cfg.repo.owner,
			repo: cfg.repo.repo,
			branch: activeCR.branch,
			path: activePath
		};
	}, [cfg?.repo?.owner, cfg?.repo?.repo, activeCR?.branch, activePath]);

  const { status: draftStatus, undoRestore, clear: clearDraft } = useDraft({
		enabled: Boolean(draftKey),
		key: draftKey,
		markdown,
		setMarkdown
	});

	// Refresh draft indicators when branch changes or a save occurs
  React.useEffect(() => {
    void (async () => {
      if (!cfg?.repo?.owner || !cfg?.repo?.repo) return;
      const defaultBranch = cfg?.repo?.defaultBranch ?? cfg?.defaultBranch ?? 'main';
      const branch = activeCR?.branch || currentRef || defaultBranch;
      if (!branch) return;
      const ds = await listDrafts({ owner: cfg.repo.owner, repo: cfg.repo.repo, branch });
      setDraftPathSet(new Set(ds.map((d) => d.path)));
      setBranchDrafts(ds);

      // Also compute drafts for published (default) branch for Local Changes tab
      const dsDefault = await listDrafts({ owner: cfg.repo.owner, repo: cfg.repo.repo, branch: defaultBranch });
      setDefaultDrafts(dsDefault);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.repo?.owner, cfg?.repo?.repo, activeCR?.branch, currentRef, draftStatus.savedAt]);

	React.useEffect(() => {
		void (async () => {
			const c = await loadConfig();
			setCfg(c);
		})();
	}, []);

  // Load Change Requests for sidebar when tab switches
  React.useEffect(() => {
    void (async () => {
      if (leftTab !== 'changes') return;
      if (!token || !cfg?.repo?.owner || !cfg?.repo?.repo) return;
      try {
        const crs = await listOpenChangeRequests({ owner: cfg.repo.owner, repo: cfg.repo.repo, token });
        setSidebarCRs(crs.map((p) => ({ number: p.number, title: p.title })));
      } catch {
        // ignore
      }
    })();
  }, [leftTab, token, cfg?.repo?.owner, cfg?.repo?.repo]);

	// Load initial tree for default branch if none selected yet
	React.useEffect(() => {
		if (!token || !cfg?.repo?.owner || !cfg?.repo?.repo) return;
	const ref = activeCR?.branch || currentRef || (cfg.repo.defaultBranch ?? cfg.defaultBranch ?? 'main');
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
    const crTitleTemplate = cfg?.repo?.crTitleTemplate ?? 'Add post: {title} ({path})';
    return { contentDir, defaultBranch, branchPrefix, pathTemplate, crTitleTemplate };
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

	async function onCreateCR(): Promise<void> {
		if (!token) return;
		setCrState({ status: 'loading' });
		const owner = cfg?.repo?.owner;
		const repo = cfg?.repo?.repo;
		if (!owner || !repo) {
			setCrState({ status: 'error', message: 'Missing repo.owner or repo.repo in .meditor.config.json' });
			return;
		}
		const base = defaults.defaultBranch;
		const inferredTitle = guessTitle();
		const slug = slugify(inferredTitle);
		const date = getDate();
		const contentDir = defaults.contentDir;
		const path = renderTemplate(defaults.pathTemplate, { contentDir, date, slug });
		const branch = `${defaults.branchPrefix}${slug}`;
    const title = renderTemplate(defaults.crTitleTemplate, { title: inferredTitle, path, branch });
		const body = `Created from the PWA editor\n\n- File: ${path}\n- Branch: ${branch}`;
		try {
			const res = await createChangeRequest({
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
				setCrState({ status: 'success', url: res.url });
				setActiveCR({ number: null, branch, url: res.url });
				setActivePath(path);
			}
		} catch (e) {
			setCrState({ status: 'error', message: (e as Error).message });
		}
	}


  async function onUpdateCR(): Promise<void> {
		if (!token || !activePath) return;
		// Ensure working on a non-default branch
		if (!activeCR || activeCR.branch === defaults.defaultBranch) {
			await ensureWorkingBranch();
		}
		if (!activeCR) return;
		const owner = cfg?.repo?.owner!;
		const repo = cfg?.repo?.repo!;
		setCrState({ status: 'loading' });
		try {
			await commitToExistingBranch({
				owner,
				repo,
				branch: activeCR.branch,
				message: `chore: update ${activePath}`,
				changes: [{ path: activePath, content: markdown }],
				token
			});
			setCrState({ status: 'success', url: activeCR.url });
		} catch (e) {
			setCrState({ status: 'error', message: (e as Error).message });
		}
	}

  function openNewFilePanel(): void {
		setNewFileOpen(true);
		setNewFilePath(defaultNewFilePath());
	}

	async function createNewFileInBranch(): Promise<void> {
		if (!token || !newFilePath) return;
		if (!activeCR || activeCR.branch === defaults.defaultBranch) {
			await ensureWorkingBranch();
		}
		if (!activeCR) return;
		const owner = cfg?.repo?.owner!;
		const repo = cfg?.repo?.repo!;
		setCrState({ status: 'loading' });
		try {
			await commitToExistingBranch({
				owner,
				repo,
				branch: activeCR.branch,
				message: `chore: add ${newFilePath}`,
				changes: [{ path: newFilePath, content: markdown }],
				token
			});
			setActivePath(newFilePath);
			setNewFileOpen(false);
			setCrState({ status: 'success', url: activeCR.url });
		} catch (e) {
			setCrState({ status: 'error', message: (e as Error).message });
		}
	}

	function usePathOnly(): void {
		if (!newFilePath) return;
		setActivePath(newFilePath);
		setNewFileOpen(false);
	}

	async function openPicker(type: 'branch'): Promise<void> {
		if (!token) return;
		const owner = cfg?.repo?.owner;
		const repo = cfg?.repo?.repo;
		if (!owner || !repo) {
			setCrState({ status: 'error', message: 'Missing repo.owner or repo.repo in .meditor.config.json' });
			return;
		}
		setCrState({ status: 'loading' });
		try {
			const branches = await listBranches({ owner, repo, token });
			setItems(branches);
			setPicker(type);
			setCrState({ status: 'idle' });
		} catch (e) {
			setCrState({ status: 'error', message: (e as Error).message });
		}
	}

  async function restoreDraftToPublished(d: DraftRecord): Promise<void> {
    if (!cfg?.repo?.owner || !cfg?.repo?.repo || !token) return;
    await clearDraftKey({ owner: d.owner, repo: d.repo, branch: d.branch, path: d.path });
    try {
      const ref = defaults.defaultBranch;
      const content = await getFileContentAtRef({ owner: d.owner, repo: d.repo, path: d.path, ref, token });
      if (activePath === d.path) {
        setMarkdown(content);
      }
      // Refresh both sets
      const dsDefault = await listDrafts({ owner: d.owner, repo: d.repo, branch: ref });
      setDefaultDrafts(dsDefault);
      const currentRefForTree = activeCR?.branch || currentRef || defaults.defaultBranch;
      const dsCurrent = await listDrafts({ owner: d.owner, repo: d.repo, branch: currentRefForTree! });
      setDraftPathSet(new Set(dsCurrent.map((x) => x.path)));
      setBranchDrafts(dsCurrent);
    } catch (e) {
      setCrState({ status: 'error', message: (e as Error).message });
    }
  }

  async function changeFileForActive(): Promise<void> {
    if (!token) return;
    const owner = cfg?.repo?.owner!;
    const repo = cfg?.repo?.repo!;
    setCrState({ status: 'loading' });
    try {
      if (!activeCR || activeCR.branch === (cfg?.repo?.defaultBranch ?? cfg?.defaultBranch ?? 'main')) {
        await ensureWorkingBranch();
      }
      const ref = (activeCR?.branch) as string;
      const paths = await listRepoPathsForRef({ owner, repo, ref, token });
      setTreePaths(paths);
      setCurrentRef(ref);
      setPicker('file');
      setCrState({ status: 'idle' });
    } catch (e) {
      setCrState({ status: 'error', message: (e as Error).message });
    }
  }

  async function selectChangeRequest(n: number): Promise<void> {
    if (!token) return;
    const owner = cfg?.repo?.owner!;
    const repo = cfg?.repo?.repo!;
    setCrState({ status: 'loading' });
    try {
      const pr = await getChangeRequestDetails({ owner, repo, number: n, token });
      setActiveCR({ number: pr.number, branch: pr.head.ref, url: pr.url });
      setCurrentRef(pr.head.ref);
      const paths = await listRepoPathsForRef({ owner, repo, ref: pr.head.ref, token });
      setTreePaths(paths);
      setPicker('file');
      setCrState({ status: 'idle' });
    } catch (e) {
      setCrState({ status: 'error', message: (e as Error).message });
    }
  }

  async function openImagePanel(): Promise<void> {
    if (!activeCR || activeCR.branch === (cfg?.repo?.defaultBranch ?? cfg?.defaultBranch ?? 'main')) {
      await ensureWorkingBranch();
    }
    setImageAlt(guessTitle());
    setImagePath('');
    setImageOpen(true);
  }

	function openSettings(): void {
		setSOwner(cfg?.repo?.owner ?? '');
		setSRepo(cfg?.repo?.repo ?? '');
		setSDefaultBranch(cfg?.repo?.defaultBranch ?? cfg?.defaultBranch ?? 'main');
		setSContentDirs((cfg?.contentDirs ?? ['src/content']).join(', '));
		setSAssetsDir(cfg?.assetsDir ?? 'src/assets');
		setSPrBranchPrefix(cfg?.repo?.prBranchPrefix ?? 'content/');
		setSPostPathTemplate(cfg?.repo?.postPathTemplate ?? '{contentDir}/{date}-{slug}.md');
    setSCrTitleTemplate(cfg?.repo?.crTitleTemplate ?? 'Add post: {title} ({path})');
		setSettingsMsg('');
		setSettingsOpen(true);
	}

	async function saveSettings(): Promise<void> {
		const contentDirs = sContentDirs.split(',').map((s) => s.trim()).filter(Boolean);
		if (!sOwner || !sRepo || !contentDirs.length) {
			setSettingsMsg('Owner, repo, and at least one contentDir are required.');
			return;
		}
		saveLocalOverrides({
			repo: {
				provider: 'github',
				owner: sOwner,
				repo: sRepo,
				defaultBranch: sDefaultBranch,
            prBranchPrefix: sPrBranchPrefix,
            postPathTemplate: sPostPathTemplate,
            crTitleTemplate: sCrTitleTemplate
			},
			contentDirs,
			assetsDir: sAssetsDir
		});
		const newCfg = await loadConfig();
		setCfg(newCfg);
		setSettingsMsg('Saved.');
		void refreshSidebarTree();
	}

	async function resetSettings(): Promise<void> {
		clearLocalOverrides();
		const newCfg = await loadConfig();
		setCfg(newCfg);
		setSettingsMsg('Reset to file/defaults.');
		void refreshSidebarTree();
	}

  async function onImageFileSelected(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageAlt(file.name.replace(/\.[^.]+$/, ''));
    setImagePath(defaultImagePath(file.name));
  }

  async function uploadAndInsertImage(): Promise<void> {
    if (!token || !imagePath) return;
    if (!activeCR || activeCR.branch === defaults.defaultBranch) {
      await ensureWorkingBranch();
    }
    if (!activeCR) return;
    const owner = cfg?.repo?.owner!;
    const repo = cfg?.repo?.repo!;
    const file = imageFileRef.current?.files?.[0];
    if (!file) {
      setCrState({ status: 'error', message: 'Choose an image file first.' });
      return;
    }
    setCrState({ status: 'loading' });
    try {
      await uploadBinaryToBranch({ owner, repo, branch: activeCR.branch, path: imagePath, file, token, message: `chore: add image ${imagePath}` });
      // Insert markdown
      const alt = imageAlt || file.name;
      const markdownLink = `![${alt}](${imagePath})`;
      editorRef.current?.insertTextAtCursor(markdownLink);
      setImageOpen(false);
      setCrState({ status: 'success', url: activeCR.url });
    } catch (e) {
      setCrState({ status: 'error', message: (e as Error).message });
    }
  }

  async function chooseBranch(branch: string): Promise<void> {
    if (!token) return;
    const owner = cfg?.repo?.owner!;
    const repo = cfg?.repo?.repo!;
    setCrState({ status: 'loading' });
    try {
      setActiveCR({ number: null, branch, url: `https://github.com/${owner}/${repo}/tree/${branch}` });
      setCurrentRef(branch);
      const paths = await listRepoPathsForRef({ owner, repo, ref: branch, token });
      setTreePaths(paths);
      setPicker('file');
      setCrState({ status: 'idle' });
    } catch (e) {
      setCrState({ status: 'error', message: (e as Error).message });
    }
  }

  async function chooseFile(path: string): Promise<void> {
    if (!token || !currentRef) return;
    const owner = cfg?.repo?.owner!;
    const repo = cfg?.repo?.repo!;
    setCrState({ status: 'loading' });
    try {
      const content = await getFileContentAtRef({ owner, repo, path, ref: currentRef, token });
      setMarkdown(content);
      setActivePath(path);
      setPicker(null);
      setCrState({ status: 'idle' });
    } catch (e) {
      setCrState({ status: 'error', message: (e as Error).message });
    }
  }

	async function chooseFileFromSidebar(path: string): Promise<void> {
		const ref = activeCR?.branch || currentRef || defaults.defaultBranch;
		if (!token || !ref) return;
		const owner = cfg?.repo?.owner!;
		const repo = cfg?.repo?.repo!;
		setCrState({ status: 'loading' });
		try {
			const content = await getFileContentAtRef({ owner, repo, path, ref, token });
			setMarkdown(content);
			setActivePath(path);
			if (!activeCR) setActiveCR({ number: null, branch: ref, url: `https://github.com/${owner}/${repo}/tree/${ref}` });
			setCrState({ status: 'idle' });
		} catch (e) {
			setCrState({ status: 'error', message: (e as Error).message });
		}
	}

	async function ensureWorkingBranch(): Promise<void> {
		if (!token || !cfg?.repo?.owner || !cfg?.repo?.repo) return;
		const base = defaults.defaultBranch;
		const owner = cfg.repo.owner;
		const repo = cfg.repo.repo;
		const inferredTitle = guessTitle();
		const slug = slugify(inferredTitle);
		const branchDesired = `${defaults.branchPrefix}${slug}`;
		try {
			await createBranchFromBase({ owner, repo, base, branch: branchDesired, token });
			setActiveCR({ number: null, branch: branchDesired, url: `https://github.com/${owner}/${repo}/tree/${branchDesired}` });
		} catch (e) {
			// If branch exists, just set it
			setActiveCR({ number: null, branch: branchDesired, url: `https://github.com/${owner}/${repo}/tree/${branchDesired}` });
		}
	}

  async function refreshSidebarTree(): Promise<void> {
    if (!token || !cfg?.repo?.owner || !cfg?.repo?.repo) return;
    const ref = activeCR?.branch || currentRef || defaults.defaultBranch;
    if (!ref) return;
    setCrState({ status: 'loading' });
    try {
      const paths = await listRepoPathsForRef({ owner: cfg.repo!.owner!, repo: cfg.repo!.repo!, ref, token });
      setTreePaths(paths);
      setCrState({ status: 'idle' });
    } catch (e) {
      setCrState({ status: 'error', message: (e as Error).message });
    }
  }
async function openOrCreateCRForBranch(): Promise<void> {
    if (!token || !activeCR) return;
    const owner = cfg?.repo?.owner!;
    const repo = cfg?.repo?.repo!;
    const base = defaults.defaultBranch;
    setCrState({ status: 'loading' });
    try {
        const existing = await findChangeRequestForBranch({ owner, repo, head: activeCR.branch, token });
        if (existing) {
            setActiveCR({ number: existing.number, branch: activeCR.branch, url: existing.url });
            setCrState({ status: 'success', url: existing.url });
            return;
        }
        const title = `Content updates for ${activeCR.branch}`;
        const body = activePath ? `Updates to ${activePath}` : undefined;
        const pr = await openChangeRequestForBranch({ owner, repo, head: activeCR.branch, base, title, body, token });
        setActiveCR({ number: pr.number, branch: activeCR.branch, url: pr.url });
        setCrState({ status: 'success', url: pr.url });
    } catch (e) {
        setCrState({ status: 'error', message: (e as Error).message });
    }
}
	if (status !== 'authed') {
		return <Login />;
	}
	return (
		<div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 1fr', height: '100vh' }}>
				<aside style={{ borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column' }}>
					<div style={{ padding: '0 12px', borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ borderBottom: leftTab === 'content' ? '2px solid #000' : '2px solid transparent', padding: '8px 0' }} onClick={() => setLeftTab('content')}>Content</button>
              <button style={{ borderBottom: leftTab === 'changes' ? '2px solid #000' : '2px solid transparent', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setLeftTab('changes')}>
                Change Requests
                <span style={{ background: '#eee', borderRadius: 8, padding: '0 6px', fontSize: 12 }}>{sidebarCRs.length}</span>
              </button>
              <button style={{ borderBottom: leftTab === 'local' ? '2px solid #000' : '2px solid transparent', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setLeftTab('local')}>
                Local Changes
                <span style={{ background: '#eee', borderRadius: 8, padding: '0 6px', fontSize: 12 }}>{defaultDrafts.length}</span>
              </button>
            </div>
            {leftTab === 'content' ? (
              <div style={{ padding: '8px 0' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" placeholder="Filter files…" value={sidebarFilter} onChange={(e) => setSidebarFilter(e.target.value)} style={{ flex: 1, padding: 6 }} />
                  <button onClick={() => void refreshSidebarTree()}>Refresh</button>
                </div>
              </div>
            ) : leftTab === 'changes' ? (
            <div style={{ padding: '8px 0' }}>
              {cfg?.repo?.owner && cfg?.repo?.repo ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <button onClick={onCreateCR} disabled={crState.status === 'loading'}>
                    {crState.status === 'loading' ? 'Creating…' : 'Create change request'}
                  </button>
              {activeCR ? (
                <button onClick={() => void switchToDefaultBranch()}>
                  Switch to Published
                </button>
              ) : null}
                  <button onClick={onUpdateCR} disabled={crState.status === 'loading'}>
                    Update change request
                  </button>
                  <button onClick={openOrCreateCRForBranch} disabled={crState.status === 'loading'}>
                    Open/Create change request
                  </button>
                  <button onClick={changeFileForActive} disabled={crState.status === 'loading'}>
                    Change file…
                  </button>
                  <button onClick={openImagePanel} disabled={crState.status === 'loading'}>
                    Insert image…
                  </button>
                  <button onClick={openNewFilePanel} disabled={crState.status === 'loading'}>
                    New file…
                  </button>
                </div>
              ) : (
                <div style={{ marginBottom: 8, color: '#666' }}>Configure your repository in Settings to manage change requests.</div>
              )}
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <input type="text" placeholder="Filter change requests…" value={sidebarCRFilter} onChange={(e) => setSidebarCRFilter(e.target.value)} style={{ flex: 1, padding: 6 }} />
                <button onClick={() => void refreshCRs()}>Refresh</button>
              </div>
            </div>
        ) : null}
      </div>
      {leftTab === 'local' && (
        <div style={{ borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <strong>Local changes</strong>
            <span style={{ fontSize: 12, color: '#666' }}>({defaultDrafts.length})</span>
          </div>
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {defaultDrafts.length === 0 ? (
              <div style={{ padding: '8px 12px', color: '#666' }}>No local changes</div>
            ) : (
              defaultDrafts.map((d) => (
                <div key={`${d.owner}/${d.repo}:${d.branch}:${d.path}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'ui-monospace, monospace' }}>{d.path}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>Saved {new Date(d.updatedAt).toLocaleString()}</div>
                  </div>
                  <button onClick={() => { setActivePath(d.path); setMarkdown(d.content); }}>Open</button>
                  <button onClick={() => void restoreDraftToPublished(d)} style={{ color: '#b50b0b' }}>Restore</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto' }}>
						{leftTab === 'content' ? (
							<FileTree
								paths={treePaths.filter((p) => (sidebarFilter ? p.toLowerCase().includes(sidebarFilter.toLowerCase()) : true))}
								roots={cfg?.contentDirs}
								onSelect={(p) => void chooseFileFromSidebar(p)}
								draftPaths={draftPathSet}
								onNewInDir={(dir) => {
									setNewFilePath(
										renderTemplate(defaults.pathTemplate, {
											contentDir: dir,
											date: getDate(),
											slug: slugify(guessTitle())
										})
									);
									setNewFileOpen(true);
								}}
							/>
						) : (
            <div>
              {sidebarCRs
                .filter((p) => (sidebarCRFilter ? (`#${p.number} ${p.title}`).toLowerCase().includes(sidebarCRFilter.toLowerCase()) : true))
                .map((p) => (
                  <div key={p.number} style={{ padding: '6px 12px', cursor: 'pointer' }} onClick={() => void selectChangeRequest(p.number)}>
                    #{p.number} — {p.title}
                  </div>
                ))}
              {sidebarCRs.length === 0 && <div style={{ padding: '8px 12px', color: '#666' }}>No open change requests</div>}
            </div>
						)}
					</div>
				{/* Sidebar footer with branch controls, sticky at bottom */}
				<div style={{ borderTop: '1px solid #e0e0e0', position: 'sticky', bottom: 0, background: '#fff', zIndex: 1 }}>
					<div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
						<span style={{ fontSize: 12, color: '#666' }}>Branch: {activeCR?.branch || currentRef || defaults.defaultBranch}</span>
						{(activeCR?.branch || currentRef) && (activeCR?.branch || currentRef) !== defaults.defaultBranch ? (
							<button onClick={() => void switchToDefaultBranch()} title={`Switch to ${defaults.defaultBranch}`} style={{ fontSize: 12, padding: '2px 6px', marginLeft: 'auto' }}>
								Switch to Published
							</button>
						) : <span style={{ flex: 1 }} />}
						<button onClick={() => void openPicker('branch')} style={{ fontSize: 12, padding: '2px 6px' }}>
							Pick branch
						</button>
					</div>
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
                <button onClick={openSettings} disabled={crState.status === 'loading'}>
                  Settings
                </button>
					</div>
				</header>
				{activeCR ? (
					<div style={{ background: '#e7f3ff', color: '#054289', padding: '6px 12px' }}>
						Working on change request #{activeCR.number ?? 'new'} — Branch: {activeCR.branch}
						{activePath ? ` — File: ${activePath}` : ''} —
						<a href={activeCR.url} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }}>Open</a>
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
              {picker && picker !== 'file' && (
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>Open Branch</strong>
                  <input type="text" placeholder="Filter branches…" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={{ padding: 4, minWidth: 240 }} />
                  <button onClick={() => setPicker(null)} style={{ marginLeft: 'auto' }}>Close</button>
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
        {settingsOpen && (
          <div style={{ borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ padding: '8px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'end' }}>
              <div>
                <label>Owner</label>
                <input type="text" value={sOwner} onChange={(e) => setSOwner(e.target.value)} style={{ width: '100%', padding: 6 }} />
              </div>
              <div>
                <label>Repo</label>
                <input type="text" value={sRepo} onChange={(e) => setSRepo(e.target.value)} style={{ width: '100%', padding: 6 }} />
              </div>
              <div>
                <label>Default branch</label>
                <input type="text" value={sDefaultBranch} onChange={(e) => setSDefaultBranch(e.target.value)} style={{ width: '100%', padding: 6 }} />
              </div>
              <div>
                <label>Content dirs (comma)</label>
                <input type="text" value={sContentDirs} onChange={(e) => setSContentDirs(e.target.value)} style={{ width: '100%', padding: 6 }} />
              </div>
              <div>
                <label>Assets dir</label>
                <input type="text" value={sAssetsDir} onChange={(e) => setSAssetsDir(e.target.value)} style={{ width: '100%', padding: 6 }} />
              </div>
              <div>
                <label>PR branch prefix</label>
                <input type="text" value={sPrBranchPrefix} onChange={(e) => setSPrBranchPrefix(e.target.value)} style={{ width: '100%', padding: 6 }} />
              </div>
              <div>
                <label>Post path template</label>
                <input type="text" value={sPostPathTemplate} onChange={(e) => setSPostPathTemplate(e.target.value)} style={{ width: '100%', padding: 6 }} />
              </div>
              <div>
                <label>Change request title template</label>
                <input type="text" value={sCrTitleTemplate} onChange={(e) => setSCrTitleTemplate(e.target.value)} style={{ width: '100%', padding: 6 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => void saveSettings()}>Save</button>
                <button onClick={() => void resetSettings()}>Reset</button>
                <button onClick={() => setSettingsOpen(false)} style={{ marginLeft: 'auto' }}>Close</button>
              </div>
              {settingsMsg && <div style={{ gridColumn: '1 / -1', color: '#555' }}>{settingsMsg}</div>}
            </div>
          </div>
        )}
        {imageOpen && (
          <div style={{ borderBottom: '1px solid #e0e0e0' }}>
            <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <strong>Insert Image</strong>
              <input ref={imageFileRef} type="file" accept="image/*" onChange={onImageFileSelected} />
              <input type="text" placeholder="Alt text" value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} style={{ padding: 6, minWidth: 160 }} />
              <input type="text" placeholder="Repo path (e.g., src/assets/2025/01/hero.png)" value={imagePath} onChange={(e) => setImagePath(e.target.value)} style={{ padding: 6, minWidth: 360 }} />
              <button onClick={uploadAndInsertImage} disabled={crState.status === 'loading' || !imagePath}>Upload & insert</button>
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
				{newFileOpen && (
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
							<button onClick={createNewFileInBranch} disabled={crState.status === 'loading' || !newFilePath}>
								Create file
							</button>
							<button onClick={usePathOnly} disabled={!newFilePath}>Use path only</button>
							<button onClick={() => setNewFileOpen(false)} style={{ marginLeft: 'auto' }}>Close</button>
						</div>
					</div>
				)}
              {crState.status === 'success' && crState.url ? (
                <div style={{ background: '#e6ffed', color: '#044a14', padding: '6px 12px' }}>
                  Change request created: <a href={crState.url} target="_blank" rel="noreferrer">{crState.url}</a>
                </div>
              ) : null}
              {crState.status === 'error' && crState.message ? (
                <div style={{ background: '#ffebe9', color: '#b50b0b', padding: '6px 12px' }}>
                  Failed to create change request: {crState.message}
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
              repo={activeCR && cfg?.repo?.owner && cfg?.repo?.repo ? { owner: cfg.repo.owner, repo: cfg.repo.repo, ref: activeCR.branch, filePath: activePath ?? undefined } : undefined}
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
