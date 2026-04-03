import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		vueDevTools(),
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	build: {
		// Library mode — emit ES module + CJS bundles and a type declaration entry.
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			name: 'VueOmniBrowser',
			// Vite will produce:
			//   dist/vue-omni-browser.js        (ESM)
			//   dist/vue-omni-browser.umd.cjs   (UMD / CommonJS)
			fileName: 'vue-omni-browser',
		},
		rollupOptions: {
			// Exclude peer dependencies from the bundle.
			external: ['vue'],
			output: {
				globals: {
					vue: 'Vue',
				},
			},
		},
	},
});
