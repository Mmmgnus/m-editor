// Eleventy-first content mapping and repo config

export type RepoInfo = {
    provider: 'github';
    owner?: string; // optional to allow local-only editing
    repo?: string;
    defaultBranch?: string; // e.g., "main"
    prBranchPrefix?: string; // e.g., "content/"
    postPathTemplate?: string; // e.g., "{contentDir}/{date}-{slug}.md"
    crTitleTemplate?: string; // e.g., "Add post: {title} ({path})"
};

export type MEditorConfig = {
	ssg: 'eleventy';
	contentDirs: string[]; // e.g., ["src/content"]
	assetsDir: string; // e.g., "src/assets"
	defaultBranch?: string; // deprecated; prefer repo.defaultBranch
	repo?: RepoInfo;
	frontmatterDefaults?: Record<string, unknown>;
};

export async function loadConfig(): Promise<MEditorConfig> {
	const defaults: MEditorConfig = {
		ssg: 'eleventy',
		contentDirs: ['src/content'],
		assetsDir: 'src/assets',
        repo: {
            provider: 'github',
            defaultBranch: 'main',
            prBranchPrefix: 'content/',
            postPathTemplate: '{contentDir}/{date}-{slug}.md',
            crTitleTemplate: 'Add post: {title} ({path})'
        },
        frontmatterDefaults: { draft: true }
    };
	for (const path of ['/.meditor.config.json', '/config/.meditor.config.json']) {
		try {
			const res = await fetch(path);
			if (!res.ok) continue;
			const cfg = (await res.json()) as Partial<MEditorConfig>;
			const merged = mergeConfig(defaults, cfg);
			return applyLocalOverrides(merged);
		} catch {
			// try next
		}
	}
	return applyLocalOverrides(defaults);
}

function mergeConfig(base: MEditorConfig, incoming: Partial<MEditorConfig>): MEditorConfig {
    const repo = { ...base.repo, ...(incoming.repo ?? {}) } as RepoInfo;
    // Back-compat for top-level defaultBranch
    if (!repo.defaultBranch && incoming.defaultBranch) repo.defaultBranch = incoming.defaultBranch;
    // Back-compat: map legacy prTitleTemplate to crTitleTemplate if new not set
    // @ts-expect-error legacy key
    if (!(repo as any).crTitleTemplate && (repo as any).prTitleTemplate) {
        // @ts-expect-error legacy key
        (repo as any).crTitleTemplate = (repo as any).prTitleTemplate;
        // @ts-expect-error legacy key
        delete (repo as any).prTitleTemplate;
    }
    return {
        ...base,
        ...incoming,
        repo,
        contentDirs: incoming.contentDirs ?? base.contentDirs,
        assetsDir: incoming.assetsDir ?? base.assetsDir,
        frontmatterDefaults: { ...base.frontmatterDefaults, ...(incoming.frontmatterDefaults ?? {}) }
    };
}

function readLocalOverrides(): Partial<MEditorConfig> | null {
	try {
		const raw = localStorage.getItem('meditor_overrides');
		if (!raw) return null;
		return JSON.parse(raw) as Partial<MEditorConfig>;
	} catch {
		return null;
	}
}

function applyLocalOverrides(base: MEditorConfig): MEditorConfig {
	const o = readLocalOverrides();
	if (!o) return base;
	return mergeConfig(base, o);
}

export function saveLocalOverrides(o: Partial<MEditorConfig>): void {
	localStorage.setItem('meditor_overrides', JSON.stringify(o));
}

export function clearLocalOverrides(): void {
	localStorage.removeItem('meditor_overrides');
}
