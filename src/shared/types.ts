export type MarkdownFile = {
	path: string; // repo-relative path
	content: string; // with frontmatter
};

export type RepoRef = {
	owner: string;
	repo: string;
	branch: string;
};

