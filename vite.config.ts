import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'M Editor',
				short_name: 'MEditor',
				description: 'Markdown editor for Eleventy sites',
				display: 'standalone',
				start_url: '/',
				background_color: '#111111',
				theme_color: '#111111',
				icons: [
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
				]
			}
		})
	],
	resolve: {
		alias: {
			'@app': fileURLToPath(new URL('./src/app', import.meta.url)),
			'@modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
			'@shared': fileURLToPath(new URL('./src/shared', import.meta.url))
		}
	},
	server: { port: 5173 }
});
