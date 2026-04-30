/*
	vite.config.js
	--------------

	Dual-mode Vite config: SPA when running `npm run dev` (the in-repo
	demo), library when running `npm run build` (the publishable
	dist/).

	Lib mode notes
	==============

	`build.lib` switches Vite into library mode using `src/index.ts`
	as the only entry. Anything not transitively reachable from there
	gets tree-shaken — App.vue, demo windows, main.js / main.ts all
	stay in source for development but don't ship.

	`rollupOptions.external` lists modules that should NOT be bundled.
	The host app provides them at consume-time, so bundling them here
	would either bloat the dist or — worse — create a SECOND copy of
	a module-singleton-bearing lib like `vue-pick-n-plop`, which would
	defeat the whole point of sharing the host's PNPDragManager.

	  - vue            : peer dep, host always provides.
	  - vue-pick-n-plop: optional peer; when host has installed it,
	                     `usePNPDragging()` inside VOB resolves to the
	                     host's installed copy AND its `inject('pnp-manager')`
	                     hits the host's manager — so a drag started in
	                     VOB and a drop zone in the host app interop
	                     for free.

	`vue-virtual-scroller` and `material-icons` stay BUNDLED (they're
	in `dependencies`, npm installs them transitively for the consumer,
	but Vite still inlines them into our dist so the consumer doesn't
	have to remember to import their stylesheets separately).

	Output
	======

	Vite emits both `dist/vue-omni-browser.js` (ES, for `import`) and
	`dist/vue-omni-browser.umd.cjs` (UMD, for `require`). The package
	exports field already points at both.

	The bundled CSS lands at `dist/vue-omni-browser.css`. We DON'T
	export a separate `./style.css` entry — the side-effect imports
	inside `VueOmniBrowser.vue` (material-icons + scoped styles) get
	folded in at build time, so the consumer only has to import the
	component.
*/

import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

export default defineConfig(({ command, mode }) => {

	const isLib = mode === 'lib' || command === 'build';

	const base = {
		plugins: [
			vue(),
			// Devtools is dev-only — having it loaded during `vite build`
			// adds noise and a hot-reload websocket reference into the
			// emitted bundle. Skip it in lib mode.
			...(isLib ? [] : [vueDevTools()]),
		],
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url)),
			},
		},
	};

	if (!isLib) return base;

	// Library build
	return {
		...base,
		build: {
			lib: {
				entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
				name: 'VueOmniBrowser',
				// Match the filenames already pinned in package.json's
				// `main` / `module` / `exports` fields.
				fileName: (format) =>
					format === 'es'
						? 'vue-omni-browser.js'
						: 'vue-omni-browser.umd.cjs',
				formats: ['es', 'umd'],
			},

			rollupOptions: {
				external: [
					'vue',
					'vue-pick-n-plop',
				],
				output: {
					globals: {
						'vue': 'Vue',
						'vue-pick-n-plop': 'VuePickNPlop',
					},
					// Keep CSS as a single emitted asset so consumers
					// only have to wire one stylesheet (or rely on the
					// component-side side-effect import that already
					// pulls it in).
					assetFileNames: (assetInfo) => {
						if (assetInfo.name && assetInfo.name.endsWith('.css')) {
							return 'vue-omni-browser.css';
						}
						return 'assets/[name]-[hash][extname]';
					},
				},
			},

			// Surfaces source maps in the dist so consumers debugging an
			// install can step into VOB internals without rebuilding it
			// from a checkout.
			sourcemap: true,

			// Don't wipe an existing dist on every dev poke — only on a
			// clean `npm run build`. Vite's default is true, which is
			// what we want for the publishable artifact, so leave it.
		},
	};
});
