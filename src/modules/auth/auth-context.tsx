import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchGitHubUser } from './github-api';
import type { GitHubUser } from './types';

type AuthState = {
	status: 'idle' | 'checking' | 'authed' | 'error' | 'signedout';
	token: string | null;
	user: GitHubUser | null;
};

type AuthContextValue = AuthState & {
	signInWithToken: (token: string) => Promise<void>;
	signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'gh_token';

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
	const [state, setState] = useState<AuthState>({ status: 'idle', token: null, user: null });

	useEffect(() => {
		const saved = localStorage.getItem(TOKEN_KEY);
		if (!saved) {
			setState({ status: 'signedout', token: null, user: null });
			return;
		}
		void verify(saved);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function verify(token: string): Promise<void> {
		setState((s) => ({ ...s, status: 'checking' }));
		try {
			const user = await fetchGitHubUser(token);
			localStorage.setItem(TOKEN_KEY, token);
			setState({ status: 'authed', token, user });
		} catch (e) {
			console.error(e);
			localStorage.removeItem(TOKEN_KEY);
			setState({ status: 'error', token: null, user: null });
		}
	}

	const value = useMemo<AuthContextValue>(
		() => ({
			...state,
			signInWithToken: verify,
			signOut: () => {
				localStorage.removeItem(TOKEN_KEY);
				setState({ status: 'signedout', token: null, user: null });
			}
		}),
		[state]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within AuthProvider');
	return ctx;
}

