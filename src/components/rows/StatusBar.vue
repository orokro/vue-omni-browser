<script setup lang="ts">
/**
 * StatusBar.vue
 * Thin informational bar, rendered at the bottom by default.
 *
 * Left side: status text from statusProvider(ctx) or a sensible built-in default.
 * Right side: item count summary.
 */

import { computed, inject } from 'vue';
import type { VobStatusBarRow } from '../../types';
import {
	VOB_ENGINE_KEY,
	VOB_NAVIGATION_KEY,
	VOB_SELECTION_KEY,
	VOB_VIEW_MODE_KEY,
	VOB_CONFIG_KEY,
} from '../../injectionKeys';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

const props = defineProps<{
	row: VobStatusBarRow;
}>();

// ----------------------------------------------------------------
// Injected state
// ----------------------------------------------------------------

const engine     = inject(VOB_ENGINE_KEY)!;
const navigation = inject(VOB_NAVIGATION_KEY)!;
const selection  = inject(VOB_SELECTION_KEY)!;
const viewMode   = inject(VOB_VIEW_MODE_KEY)!;
const config     = inject(VOB_CONFIG_KEY)!;

// ----------------------------------------------------------------
// Context and text
// ----------------------------------------------------------------

const currentItems = computed(() =>
	engine.getChildren(navigation.currentFolderId.value),
);

const statusText = computed<string>(() => {
	if (props.row.statusProvider) {
		return props.row.statusProvider({
			currentItems: currentItems.value,
			selectedItems: selection.selectedItems.value,
			currentFolderId: navigation.currentFolderId.value,
			viewMode: viewMode.viewMode.value,
		});
	}

	const selCount = selection.selectedIds.value.size;
	if (selCount > 0) {
		return `${selCount} item${selCount !== 1 ? 's' : ''} selected`;
	}
	return '';
});

const itemCountText = computed<string>(() => {
	const total = currentItems.value.length;
	return `${total} item${total !== 1 ? 's' : ''}`;
});

// ----------------------------------------------------------------
// Bar height style
// ----------------------------------------------------------------

const barStyle = computed(() =>
	props.row.height ? { height: props.row.height } : { height: '24px' },
);
</script>

<template>
	<div
		class="vob-bar vob-bar--bottom vob-statusbar"
		:style="barStyle"
		role="status"
		aria-live="polite"
	>
		<span class="vob-statusbar__text">{{ statusText }}</span>
		<span class="vob-statusbar__spacer" />
		<span class="vob-statusbar__count">{{ itemCountText }}</span>
	</div>
</template>

<style scoped>
.vob-statusbar {
	font-size: 11px;
	color: var(--vob-text-muted);
	padding: 0 8px;
	gap: 4px;
}

.vob-statusbar__text {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.vob-statusbar__spacer {
	flex: 1;
}

.vob-statusbar__count {
	flex-shrink: 0;
	white-space: nowrap;
}
</style>
