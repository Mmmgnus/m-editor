// Uses Vite PWA virtual module if available
export function setupPWA(): void {
	// dynamic import without await to keep API sync
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore - virtual module injected by vite-plugin-pwa
	void import('virtual:pwa-register')
		.then(({ registerSW }) => {
			registerSW({ immediate: true });
		})
		.catch(() => {
			// Plugin not available yet; ignore gracefully in dev.
		});
}
