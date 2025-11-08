// Eleventy-first content mapping and repo config

export type RepoInfo = {
    provider: 'github';
    owner?: string; // optional to allow local-only editing
    repo?: string;
    defaultBranch?: string; // e.g., "main"
    prBranchPrefix?: string; // e.g., "content/"
    postPathTemplate?: string; // e.g., "{contentDir}/{date}-{slug}.md"
    prTitleTemplate?: string; // e.g., "Add post: {title} ({path})"
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
            prTitleTemplate: 'Add post: {title} ({path})'
        },
        frontmatterDefaults: { draft: true }
    };
		for (const path of ['/.meditor.config.json', '/config/.meditor.config.json']) {
		try {
			const res = await fetch(path);
			if (!res.ok) continue;
			const cfg = (await res.json()) as Partial<MEditorConfig>;
			return mergeConfig(defaults, cfg);
		} catch {
			// try next
		}
	}
	return defaults;
}

function mergeConfig(base: MEditorConfig, incoming: Partial<MEditorConfig>): MEditorConfig {
	const repo = { ...base.repo, ...(incoming.repo ?? {}) } as RepoInfo;
	// Back-compat for top-level defaultBranch
	if (!repo.defaultBranch && incoming.defaultBranch) repo.defaultBranch = incoming.defaultBranch;
	return {
		...base,
		...incoming,
		repo,
		contentDirs: incoming.contentDirs ?? base.contentDirs,
		assetsDir: incoming.assetsDir ?? base.assetsDir,
		frontmatterDefaults: { ...base.frontmatterDefaults, ...(incoming.frontmatterDefaults ?? {}) }
	};
}
