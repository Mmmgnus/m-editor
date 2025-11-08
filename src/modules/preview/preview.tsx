import React from 'react';
import { parseFrontmatter, renderMarkdown } from './renderer';

export function Preview({ markdown, repo, assetsDir }: { markdown: string; repo?: { owner: string; repo: string; ref: string; filePath?: string }; assetsDir?: string }): JSX.Element {
    const [html, setHtml] = React.useState<string>('');
    const [status, setStatus] = React.useState<'idle' | 'rendering'>('idle');
    const [fm, setFm] = React.useState<Record<string, unknown>>({});

	React.useEffect(() => {
		let cancelled = false;
        setStatus('rendering');
        const { data, content } = parseFrontmatter(markdown);
        setFm(data ?? {});
        const resolver = repo
            ? (src: string) => {
                  if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return null;
                  // treat leading slash as repo root
                  let path = src.startsWith('/') ? src.slice(1) : src;
                  const rootLike = assetsDir && path.startsWith(assetsDir);
                  if (!src.startsWith('/') && !rootLike) {
                      const baseDir = (repo.filePath && repo.filePath.includes('/')) ? repo.filePath.slice(0, repo.filePath.lastIndexOf('/')) + '/' : '';
                      try {
                          const u = new URL(path, 'https://x/' + baseDir);
                          path = u.pathname.slice(1);
                      } catch {
                          // fallback, leave as is
                      }
                  }
                  return `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.ref}/${path}`;
              }
            : undefined;
        void renderMarkdown(content, { resolveImage: resolver })
            .then((out) => {
                if (!cancelled) setHtml(out);
            })
            .finally(() => {
                if (!cancelled) setStatus('idle');
            });
		return () => {
			cancelled = true;
		};
	}, [markdown]);

	return (
		<div style={{ padding: 12, overflow: 'auto', height: 'calc(100vh - 40px)' }}>
			{Object.keys(fm).length > 0 && (
				<div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
					<strong>Metadata:</strong>
					{fm['title'] ? <span style={{ marginLeft: 8 }}>Title: {String(fm['title'])}</span> : null}
					{fm['date'] ? <span style={{ marginLeft: 8 }}>Date: {String(fm['date'])}</span> : null}
				</div>
			)}
			{status === 'rendering' && <div style={{ opacity: 0.6 }}>Rendering…</div>}
			<div dangerouslySetInnerHTML={{ __html: html }} />
		</div>
	);
}
