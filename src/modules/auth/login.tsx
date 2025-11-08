import React, { useState } from 'react';
import { useAuth } from './auth-context';

export function Login(): JSX.Element {
	const { status, signInWithToken } = useAuth();
	const [token, setToken] = useState('');
	const [busy, setBusy] = useState(false);

	async function onSubmit(e: React.FormEvent): Promise<void> {
		e.preventDefault();
		setBusy(true);
		try {
			await signInWithToken(token.trim());
		} finally {
			setBusy(false);
		}
	}

	return (
		<div style={{ display: 'grid', placeContent: 'center', height: '100vh' }}>
			<div style={{ minWidth: 360, padding: 16 }}>
				<h1 style={{ margin: 0 }}>Sign in to GitHub</h1>
				<p style={{ color: '#555' }}>
					Use a personal access token with repo scope for now. Device flow will arrive later.
				</p>
				<form onSubmit={onSubmit}>
					<label htmlFor="token">Personal access token</label>
					<input
						id="token"
						type="password"
						value={token}
						onChange={(e) => setToken(e.target.value)}
						placeholder="ghp_xxx or fine-grained token"
						style={{ width: '100%', padding: 8, marginTop: 4, marginBottom: 12 }}
						required
					/>
					<button type="submit" disabled={busy} style={{ padding: '8px 12px' }}>
						{busy ? 'Signing in…' : 'Sign in'}
					</button>
				</form>
				{status === 'error' ? (
					<p style={{ color: '#c00' }}>Authentication failed. Check your token and try again.</p>
				) : null}
			</div>
		</div>
	);
}

