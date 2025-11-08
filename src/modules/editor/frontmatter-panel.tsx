import React from 'react';
import { parseFrontmatter, updateMarkdownFrontmatter } from '@modules/preview/renderer';

type Props = {
	markdown: string;
	onChange: (next: string) => void;
};

function toTagsInput(v: unknown): string {
	if (Array.isArray(v)) return (v as unknown[]).map(String).join(', ');
	if (typeof v === 'string') return v;
	return '';
}

function parseTagsInput(s: string): string[] {
	return s
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);
}

export function FrontmatterPanel({ markdown, onChange }: Props): JSX.Element {
	const { data } = parseFrontmatter(markdown);
	const [title, setTitle] = React.useState<string>(String(data.title ?? ''));
	const [date, setDate] = React.useState<string>(String(data.date ?? ''));
	const [tags, setTags] = React.useState<string>(toTagsInput(data.tags));
	const [draft, setDraft] = React.useState<boolean>(Boolean(data.draft ?? true));
	const [errors, setErrors] = React.useState<Record<string, string>>({});

	React.useEffect(() => {
		setTitle(String(data.title ?? ''));
		setDate(String(data.date ?? ''));
		setTags(toTagsInput(data.tags));
		setDraft(Boolean(data.draft ?? true));
		setErrors({});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [markdown]);

	function validate(next: { title: string; date: string }): Record<string, string> {
		const errs: Record<string, string> = {};
		if (!next.title.trim()) errs.title = 'Title is required';
		if (next.date && !/^\d{4}-\d{2}-\d{2}$/.test(next.date)) errs.date = 'Use YYYY-MM-DD';
		return errs;
	}

	// Live validation while typing
	React.useEffect(() => {
		setErrors(validate({ title, date }));
	}, [title, date]);

	function commit(partial: Partial<{ title: string; date: string; tags: string; draft: boolean }>): void {
		const next = {
			title,
			date,
			tags,
			draft,
			...partial
		};
		const errs = validate({ title: next.title, date: next.date });
		setErrors(errs);
		const updated = updateMarkdownFrontmatter(markdown, (prev) => ({
			...prev,
			title: next.title,
			date: next.date,
			tags: parseTagsInput(next.tags ?? ''),
			draft: Boolean(next.draft)
		}));
		onChange(updated);
	}

	return (
		<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, padding: '8px 12px', borderBottom: '1px solid #e0e0e0' }}>
			<div>
				<label>Title</label>
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					aria-invalid={Boolean(errors.title)}
					onBlur={() => commit({})}
					style={{ width: '100%', padding: 6 }}
				/>
				{errors.title && <div style={{ color: '#b50b0b', fontSize: 12 }}>{errors.title}</div>}
			</div>
			<div>
				<label>Date</label>
				<input
					type="text"
					placeholder="YYYY-MM-DD"
					value={date}
					onChange={(e) => setDate(e.target.value)}
					aria-invalid={Boolean(errors.date)}
					onBlur={() => commit({})}
					style={{ width: '100%', padding: 6 }}
				/>
				{errors.date && <div style={{ color: '#b50b0b', fontSize: 12 }}>{errors.date}</div>}
			</div>
			<div>
				<label>Tags</label>
				<input
					type="text"
					placeholder="tag1, tag2"
					value={tags}
					onChange={(e) => setTags(e.target.value)}
					onBlur={() => commit({})}
					style={{ width: '100%', padding: 6 }}
				/>
				<div style={{ color: '#666', fontSize: 12 }}>Comma-separated list</div>
			</div>
			<div style={{ alignSelf: 'end' }}>
				<label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					<input
						type="checkbox"
						checked={draft}
						onChange={(e) => {
							setDraft(e.target.checked);
							commit({ draft: e.target.checked });
						}}
					/>
					Draft
				</label>
			</div>
		</div>
	);
}
