<script setup lang="ts">
/**
 * ContentArea.vue
 * Routes to the correct view component based on the active view mode.
 *
 * This component is a thin dispatcher — all item logic lives inside the
 * individual view components. It also handles keyboard shortcuts that apply
 * globally across all views (Ctrl+A select-all, Delete, F2 rename, Escape).
 */

import { computed, inject } from 'vue';
import { VOB } from '../../constants';
import {
	VOB_ENGINE_KEY,
	VOB_NAVIGATION_KEY,
	VOB_SELECTION_KEY,
	VOB_SORT_FILTER_KEY,
	VOB_VIEW_MODE_KEY,
	VOB_DATA_SPEC_KEY,
	VOB_INLINE_RENAME_KEY,
} from '../../injectionKeys';
import ListView   from './ListView.vue';
import IconView   from './IconView.vue';
import TreeView   from './TreeView.vue';
import ColumnView from './ColumnView.vue';

// ----------------------------------------------------------------
// Injected state
// ----------------------------------------------------------------

const engine       = inject(VOB_ENGINE_KEY)!;
const navigation   = inject(VOB_NAVIGATION_KEY)!;
const selection    = inject(VOB_SELECTION_KEY)!;
const sortFilter   = inject(VOB_SORT_FILTER_KEY)!;
const viewMode     = inject(VOB_VIEW_MODE_KEY)!;
const dataSpec     = inject(VOB_DATA_SPEC_KEY)!;
const inlineRename = inject(VOB_INLINE_RENAME_KEY)!;

// ----------------------------------------------------------------
// Active view
// ----------------------------------------------------------------

const activeView = computed(() => {
	switch (viewMode.viewMode.value) {
		case VOB.VIEW_MODES.LIST:
		case VOB.VIEW_MODES.DETAILS:
			return ListView;
		case VOB.VIEW_MODES.ICONS:
			return IconView;
		case VOB.VIEW_MODES.TREE:
			return TreeView;
		case VOB.VIEW_MODES.COLUMNS:
			return ColumnView;
		default:
			return ListView;
	}
});

// ----------------------------------------------------------------
// Content-area keyboard shortcuts
// These are global to the content area, not per-view.
// Individual views handle rename input keys directly.
// ----------------------------------------------------------------

/** Visible items in the current folder (used for select-all). */
const currentItems = computed(() =>
	sortFilter.applyToItems(
		engine.getChildren(navigation.currentFolderId.value),
		dataSpec.value,
	),
);

/**
 * Handle keydown events on the content area wrapper.
 * Only fires when focus is inside the content area and no rename is active.
 */
function handleKeydown(event: KeyboardEvent): void {
	// If a rename input is focused, let it handle its own keys.
	if (inlineRename.renamingId.value) return;

	switch (event.key) {
		case 'a':
		case 'A':
			if (event.ctrlKey || event.metaKey) {
				event.preventDefault();
				selection.selectAll(currentItems.value.map((i) => i.id));
			}
			break;
		case 'Escape':
			selection.clearSelection();
			break;
		case 'Enter':
			// Enter with a single selection → open folder or no-op.
			if (selection.selectedIds.value.size === 1) {
				const id = [...selection.selectedIds.value][0];
				const item = engine.getItem(id);
				const def = item ? engine.getTypeDefinition(item.type) : undefined;
				if (def?.hasChildren) {
					navigation.navigateTo([...navigation.currentPathIds.value, id]);
					selection.clearSelection();
				}
			}
			break;
	}
}
</script>

<template>
	<!-- tabindex makes the div focusable so keydown fires without a child input -->
	<div
		class="vob-content-area"
		tabindex="-1"
		@keydown="handleKeydown"
	>
		<component :is="activeView" />
	</div>
</template>
