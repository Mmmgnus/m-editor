import { get, set, del, keys } from 'idb-keyval';

export type DraftKey = {
	owner: string;
	repo: string;
	branch: string;
	path: string;
};

export type DraftRecord = DraftKey & {
	content: string;
	updatedAt: number; // epoch ms
};

export function keyString(k: DraftKey): string {
	return `draft:${k.owner}/${k.repo}:${k.branch}:${k.path}`;
}

export async function saveDraft(rec: DraftRecord): Promise<void> {
	await set(keyString(rec), rec);
}

export async function loadDraft(k: DraftKey): Promise<DraftRecord | null> {
	const v = (await get(keyString(k))) as DraftRecord | undefined;
	return v ?? null;
}

export async function clearDraft(k: DraftKey): Promise<void> {
	await del(keyString(k));
}

export async function listDrafts(filter?: Partial<DraftKey>): Promise<DraftRecord[]> {
	const allKeys = (await keys()) as string[];
	const relevant = allKeys.filter((k) => k.startsWith('draft:'));
	const out: DraftRecord[] = [];
	for (const k of relevant) {
		const v = (await get(k)) as DraftRecord | undefined;
		if (!v) continue;
		if (filter) {
			if (filter.owner && v.owner !== filter.owner) continue;
			if (filter.repo && v.repo !== filter.repo) continue;
			if (filter.branch && v.branch !== filter.branch) continue;
			if (filter.path && v.path !== filter.path) continue;
		}
		out.push(v);
	}
	return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

