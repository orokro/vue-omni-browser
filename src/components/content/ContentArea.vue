<script setup lang="ts">
/**
 * ContentArea.vue
 * Routes to the correct view component based on the active view mode.
 *
 * This component is a thin dispatcher — all item logic lives inside the
 * individual view components. Global keyboard shortcuts are handled by
 * useKeyboardShortcuts (registered in VueOmniBrowser.vue).
 */

import { computed, inject } from 'vue';
import { VOB } from '../../constants';
import { VOB_VIEW_MODE_KEY } from '../../injectionKeys';
import ListView   from './ListView.vue';
import IconView   from './IconView.vue';
import TreeView   from './TreeView.vue';
import ColumnView from './ColumnView.vue';

// ----------------------------------------------------------------
// Injected state
// ----------------------------------------------------------------

const viewMode = inject(VOB_VIEW_MODE_KEY)!;

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
</script>

<template>
	<!-- tabindex makes the div focusable so the container can receive focus
	     for keyboard shortcuts scoped via containerRef in useKeyboardShortcuts -->
	<div class="vob-content-area" tabindex="-1">
		<component :is="activeView" />
	</div>
</template>
