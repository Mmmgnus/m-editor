import React from 'react';
import { clearDraft, DraftKey, DraftRecord, loadDraft, saveDraft } from './drafts';

export type DraftStatus = {
	mode: 'idle' | 'saving' | 'restored';
	savedAt?: number;
	hasDraft: boolean;
	restoredFrom?: number;
};

export function useDraft(params: {
	enabled: boolean;
	key: DraftKey | null;
	markdown: string;
	setMarkdown: (v: string) => void;
}): {
	status: DraftStatus;
	restore: () => Promise<void>;
	undoRestore: () => void;
	clear: () => Promise<void>;
} {
	const { enabled, key, markdown, setMarkdown } = params;
	const [status, setStatus] = React.useState<DraftStatus>({ mode: 'idle', hasDraft: false });
const prevContentRef = React.useRef<string | null>(null);
const saveTimer = React.useRef<number | null>(null);
const baselineRef = React.useRef<string>('');
const readyRef = React.useRef<boolean>(false);

	// Load draft on key change and auto-restore
	React.useEffect(() => {
		if (!enabled || !key) {
			setStatus({ mode: 'idle', hasDraft: false });
			return;
		}
		let cancelled = false;
readyRef.current = false;
void (async () => {
  const d = await loadDraft(key);
  if (cancelled) return;
  if (d && d.content !== markdown) {
    prevContentRef.current = markdown;
    setMarkdown(d.content);
    setStatus({ mode: 'restored', hasDraft: true, restoredFrom: d.updatedAt });
  } else {
    setStatus({ mode: 'idle', hasDraft: Boolean(d), savedAt: d?.updatedAt });
  }
  baselineRef.current = d?.content ?? markdown;
  readyRef.current = true;
})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, key?.owner, key?.repo, key?.branch, key?.path]);

	// Autosave on content change (debounced)
	React.useEffect(() => {
if (!enabled || !key) return;
if (!readyRef.current) return;
if (markdown === baselineRef.current) return;
if (saveTimer.current) window.clearTimeout(saveTimer.current);
saveTimer.current = window.setTimeout(async () => {
  const rec: DraftRecord = { ...key, content: markdown, updatedAt: Date.now() };
  setStatus((s) => ({ ...s, mode: 'saving' }));
  await saveDraft(rec);
  setStatus({ mode: 'idle', hasDraft: true, savedAt: rec.updatedAt });
  baselineRef.current = markdown;
}, 500);
		return () => {
			if (saveTimer.current) window.clearTimeout(saveTimer.current);
		};
	}, [enabled, key, markdown]);

	async function restore(): Promise<void> {
		if (!enabled || !key) return;
		const d = await loadDraft(key);
		if (!d) return;
		prevContentRef.current = markdown;
		setMarkdown(d.content);
		setStatus({ mode: 'restored', hasDraft: true, restoredFrom: d.updatedAt });
	}

	function undoRestore(): void {
		if (prevContentRef.current == null) return;
		setMarkdown(prevContentRef.current);
		prevContentRef.current = null;
		setStatus((s) => ({ ...s, mode: 'idle' }));
	}

	async function clear(): Promise<void> {
		if (!enabled || !key) return;
		await clearDraft(key);
		setStatus({ mode: 'idle', hasDraft: false });
	}

	return { status, restore, undoRestore, clear };
}
