import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rewriteImages from './rehype-rewrite-images';
import YAML from 'yaml';
// Avoid gray-matter in the browser to prevent Buffer polyfill issues.

export type FrontmatterResult = { data: Record<string, unknown>; content: string };

export function parseFrontmatter(md: string): FrontmatterResult {
	if (!md) return { data: {}, content: '' };
	const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
	if (m && m.index === 0) {
		const yamlSrc = m[1];
		let data: Record<string, unknown> = {};
		try {
			data = YAML.parse(yamlSrc) ?? {};
		} catch {
			data = {};
		}
		return { data, content: md.slice(m[0].length) };
	}
	return { data: {}, content: md };
}

// Render markdown to sanitized HTML. Frontmatter is stripped but preserved in parsing.
export async function renderMarkdown(markdown: string, opts?: { resolveImage?: (src: string) => string | null }): Promise<string> {
    const { content } = parseFrontmatter(markdown ?? '');
    const p = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype, { allowDangerousHtml: false });
    if (opts?.resolveImage) {
        p.use(rewriteImages as any, { resolve: opts.resolveImage });
    }
    const file = await p
        .use(rehypeSanitize, defaultSchema)
        .use(rehypeStringify)
        .process(content);
    return String(file.value);
}

export function serializeFrontmatter(data: Record<string, unknown>, content: string): string {
	const safeData = data ?? {};
	const yaml = YAML.stringify(safeData).trimEnd();
	const body = content?.startsWith('\n') ? content : `\n${content ?? ''}`;
	return `---\n${yaml}\n---${body}`;
}

export function updateMarkdownFrontmatter(
	markdown: string,
	updater: (prev: Record<string, unknown>) => Record<string, unknown>
): string {
	const { data, content } = parseFrontmatter(markdown ?? '');
	const next = updater({ ...(data ?? {}) });
	return serializeFrontmatter(next, content);
}
