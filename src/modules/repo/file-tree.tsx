import React from 'react';

type Node = {
	name: string;
	path: string;
	type: 'dir' | 'file';
	children?: Node[];
};

function buildTree(paths: string[], rootPrefix?: string): Node[] {
	const filtered = rootPrefix
		? paths.filter((p) => p.startsWith(rootPrefix + '/')).map((p) => p.slice(rootPrefix.length + 1))
		: paths.slice();
	const root: Record<string, Node> = {};
	for (const p of filtered) {
		const parts = p.split('/');
		let curDict = root;
		let curPath = rootPrefix ? rootPrefix : '';
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const isFile = i === parts.length - 1;
			const key = part;
			if (!curDict[key]) {
				const node: Node = {
					name: part,
					path: curPath ? `${curPath}/${part}` : part,
					type: isFile ? 'file' : 'dir',
					children: isFile ? undefined : {}
				} as unknown as Node;
				curDict[key] = node;
			}
			const node = curDict[key];
			curPath = node.path;
			if (!isFile) {
				// @ts-expect-error internal dict
				curDict = node.children as Record<string, Node>;
			}
		}
	}
	function toArray(dict: Record<string, Node>): Node[] {
		return Object.values(dict)
			.sort((a, b) => {
				if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
				return a.name.localeCompare(b.name);
			})
			.map((n) => (n.type === 'dir' ? { ...n, children: toArray(n.children as any) } : n));
	}
	return toArray(root);
}

export function FileTree({
	paths,
	onSelect,
	roots,
	filterExt = ['.md', '.markdown', '.mdx'],
	draftPaths,
	changedPaths,
	onNewInDir
}: {
	paths: string[];
	onSelect: (path: string) => void;
	roots?: string[]; // limit to these roots
	filterExt?: string[];
	draftPaths?: Set<string>;
	changedPaths?: Set<string>;
	onNewInDir?: (dirPath: string) => void;
}): JSX.Element {
	const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

	const trees = React.useMemo(() => {
		const selectedRoots = roots && roots.length ? roots : [''];
		return selectedRoots.map((r) => ({ root: r, nodes: buildTree(paths, r || undefined) }));
	}, [paths, roots]);

	function toggle(path: string): void {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(path)) next.delete(path);
			else next.add(path);
			return next;
		});
	}

	function renderNodes(nodes: Node[]): JSX.Element {
		return (
			<div>
				{nodes.map((n) => {
					if (n.type === 'dir') {
						const isOpen = expanded.has(n.path);
						return (
							<div key={n.path}>
								<div style={{ display: 'flex', alignItems: 'center', padding: '4px 12px', color: '#333' }}>
									<span style={{ cursor: 'pointer', flex: 1 }} onClick={() => toggle(n.path)}>
										{isOpen ? '▾' : '▸'} {n.name}
									</span>
									{onNewInDir ? (
										<button
											style={{ fontSize: 12, padding: '2px 6px' }}
											onClick={() => onNewInDir(n.path)}
										>
											+ New
										</button>
									) : null}
								</div>
								{isOpen && <div style={{ paddingLeft: 12 }}>{renderNodes(n.children || [])}</div>}
							</div>
						);
					}
					// file
					const isMatch = filterExt.some((ext) => n.path.endsWith(ext));
					if (!isMatch) return <React.Fragment key={n.path} />;
					return (
						<div
							key={n.path}
							style={{ padding: '2px 12px', cursor: 'pointer', color: '#222', display: 'flex', alignItems: 'center', gap: 6 }}
							onClick={() => onSelect(n.path)}
						>
							{n.name}
							{changedPaths?.has(n.path) ? (
								<span title="Changed in branch" style={{ color: '#2563eb', marginRight: 4 }}>•</span>
							) : null}
							{draftPaths?.has(n.path) ? (
								<span title="Uncommitted local changes" style={{ color: '#f59e0b' }}>•</span>
							) : null}
						</div>
					);
				})}
			</div>
		);
	}

	return (
		<div style={{ maxHeight: 260, overflow: 'auto' }}>
			{trees.map((t) => (
				<div key={t.root || '(root)'}>
					{t.root ? <div style={{ padding: '4px 12px', fontWeight: 600 }}>{t.root}</div> : null}
					{renderNodes(t.nodes)}
				</div>
			))}
		</div>
	);
}
