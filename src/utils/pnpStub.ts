/**
 * @file pnpStub.ts
 * @description No-op stubs for the vue-pick-n-plop API surface.
 *
 * This file is aliased as "vue-pick-n-plop" by vite.config.ts when the real
 * package is not installed (i.e. the consumer hasn't added it as a dep).
 * All directives become empty objects (Vue silently ignores no-op directives),
 * the PNP plugin is a harmless no-op, and usePNPDragging() returns an inert
 * manager so isDragging / activeDrag checks never throw.
 *
 * When the real vue-pick-n-plop IS installed the alias is never applied and
 * the actual package is used instead.
 */

import type { Directive, Plugin } from 'vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

// ----------------------------------------------------------------
// Directives — all no-ops
// ----------------------------------------------------------------

/** No-op draggable directive. */
export const vPnpDraggable: Directive = {};

/** No-op dropzone directive. */
export const vPnpDropzone: Directive = {};

/** No-op drag-handle directive. */
export const vPnpDraghandle: Directive = {};

// ----------------------------------------------------------------
// PNPDragLayer — null so `v-if="pnpDragLayer"` hides it
// ----------------------------------------------------------------

export const PNPDragLayer = null;

// ----------------------------------------------------------------
// usePNPDragging — returns an inert manager
// ----------------------------------------------------------------

/** Stub activeDrag returned when PNP is absent. */
const _inertActiveDrag = {
	isDragging: false as boolean,
	ctx: null as null,
	groupCtx: [] as unknown[],
};

/** isDragging ref — always false in stub. */
export const isDragging: Ref<boolean> = ref(false);

/** Stub manager returned when PNP is absent. */
const _inertManager = {
	isDragging,
	activeDrag: _inertActiveDrag,
};

/**
 * Stub composable. Returns an inert manager whose shape mirrors the real
 * PNP manager so useDragDrop.ts can use it without null-guards.
 */
export function usePNPDragging(): typeof _inertManager {
	return _inertManager;
}

// ----------------------------------------------------------------
// Default plugin export — no-op install
// ----------------------------------------------------------------

const PNPPlugin: Plugin = {
	install(): void {
		// no-op — PNP not installed
	},
};

export default PNPPlugin;
