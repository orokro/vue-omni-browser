import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

/**
 * Detect whether the optional peer dependency is installed.
 * When absent we alias "vue-pick-n-plop" → our local no-op stub so that
 * static imports in the view components resolve cleanly in both dev and build.
 */
const hasPNP = existsSync(resolve(__dirname, 'node_modules/vue-pick-n-plop'));

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		vueDevTools(),
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
			// Only applied when vue-pick-n-plop is not installed.
			...(!hasPNP && {
				'vue-pick-n-plop': resolve(__dirname, 'src/utils/pnpStub.ts'),
			}),
		},
	},
	optimizeDeps: {
		// Force pre-bundling for packages with CJS-only transitive dependencies.
		// Without this Vite/rolldown's import-analysis fails on the mixed ESM→CJS chain.
		include: [
			...(hasPNP ? ['vue-pick-n-plop'] : []),
			// vue-win-mgr: pre-bundle in case it ships CJS transitive deps
			'vue-win-mgr',
		],
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
			// vue-pick-n-plop is intentionally excluded even when installed —
			// consumers that want DnD must add it to their own deps.
			external: ['vue', 'vue-pick-n-plop'],
			output: {
				globals: {
					vue: 'Vue',
					'vue-pick-n-plop': 'VuePickNPlop',
				},
			},
		},
	},
});
