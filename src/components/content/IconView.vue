<script setup lang="ts">
/**
 * IconView.vue
 * Renders the current folder's items as a zoom-aware icon grid.
 *
 * Each cell shows a large icon and the item name (up to two lines).
 * Zoom is read from the view-mode composable; the grid cell dimensions
 * scale proportionally via a CSS custom property `--vob-zoom`.
 */

import { computed, inject } from 'vue';
import type { VobItem } from '../../types';
import { vFocusSelect } from '@/directives/focusSelect';
import { vPnpDraggable, vPnpDropzone } from 'vue-pick-n-plop';
import {
	VOB_ENGINE_KEY,
	VOB_NAVIGATION_KEY,
	VOB_SELECTION_KEY,
	VOB_SORT_FILTER_KEY,
	VOB_VIEW_MODE_KEY,
	VOB_CLIPBOARD_KEY,
	VOB_DATA_SPEC_KEY,
	VOB_INLINE_RENAME_KEY,
	VOB_CONTEXT_MENU_KEY,
	VOB_OPEN_ITEM_KEY,
	VOB_DRAG_DROP_KEY,
} from '../../injectionKeys';

// ----------------------------------------------------------------
// Injected state
// ----------------------------------------------------------------

const engine       = inject(VOB_ENGINE_KEY)!;
const navigation   = inject(VOB_NAVIGATION_KEY)!;
const selection    = inject(VOB_SELECTION_KEY)!;
const sortFilter   = inject(VOB_SORT_FILTER_KEY)!;
const viewMode     = inject(VOB_VIEW_MODE_KEY)!;
const clipboard    = inject(VOB_CLIPBOARD_KEY)!;
const dataSpec     = inject(VOB_DATA_SPEC_KEY)!;
const inlineRename = inject(VOB_INLINE_RENAME_KEY)!;
const contextMenu  = inject(VOB_CONTEXT_MENU_KEY)!;
const openItem     = inject(VOB_OPEN_ITEM_KEY)!;
const dragDrop     = inject(VOB_DRAG_DROP_KEY)!;

// ----------------------------------------------------------------
// Current items & grid
// ----------------------------------------------------------------

const currentItems = computed<VobItem[]>(() =>
	sortFilter.applyToItems(
		engine.getChildren(navigation.currentFolderId.value),
		dataSpec.value,
	),
);

const orderedIds = computed<string[]>(() => currentItems.value.map((i) => i.id));

/** CSS custom property object passed to the grid container for zoom scaling. */
const zoomStyle = computed(() => ({ '--vob-zoom': viewMode.zoom.value }));

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Returns the icon string for an item. */
function iconFor(item: VobItem): string {
	const def = engine.getTypeDefinition(item.type);
	if (def?.icon && typeof def.icon === 'string') return def.icon;
	return def?.hasChildren ? 'folder' : 'insert_drive_file';
}

// ----------------------------------------------------------------
// Interaction
// ----------------------------------------------------------------

function handleClick(item: VobItem, event: MouseEvent): void {
	if (inlineRename.isRenaming(item.id)) return;
	const mod = event.ctrlKey || event.metaKey ? 'ctrl' : event.shiftKey ? 'shift' : 'none';
	selection.handleClick(item.id, mod, orderedIds.value);
}

function handleDblClick(item: VobItem): void {
	if (inlineRename.isRenaming(item.id)) return;
	openItem.openItem(item);
}

// ----------------------------------------------------------------
// Context menu
// ----------------------------------------------------------------

/**
 * Right-click on an icon cell.
 */
function handleContextMenu(item: VobItem, event: MouseEvent): void {
	if (inlineRename.isRenaming(item.id)) return;
	contextMenu.openForItem(item, event);
}

/**
 * Right-click on the empty grid area.
 */
function handleBgContextMenu(event: MouseEvent): void {
	contextMenu.openForBackground(navigation.currentFolderId.value, event);
}

// ----------------------------------------------------------------
// Inline rename
// ----------------------------------------------------------------

function handleRenameKeydown(event: KeyboardEvent): void {
	if (event.key === 'Enter') {
		event.preventDefault();
		inlineRename.commitRename();
	} else if (event.key === 'Escape') {
		event.preventDefault();
		inlineRename.cancelRename();
	}
}
</script>

<template>
	<div class="vob-icon-view" :style="zoomStyle" @contextmenu.self.prevent="handleBgContextMenu($event)">
		<div class="vob-icon-grid"
			@contextmenu.self.prevent="handleBgContextMenu($event)"
			v-pnp-dropzone="dragDrop.dropzoneOpts(navigation.currentFolderId.value)">
			<div
				v-for="item in currentItems"
				:key="item.id"
				class="vob-icon-cell"
				:class="{
					'vob-icon-cell--selected': selection.isSelected(item.id),
					'vob-icon-cell--cut':      clipboard.isCut(item.id),
					'vob-icon-cell--dragging': dragDrop.isDraggingItem(item.id),
				}"
				@click="handleClick(item, $event)"
				@dblclick="handleDblClick(item)"
				@contextmenu.prevent="handleContextMenu(item, $event)"
				v-pnp-draggable="dragDrop.draggableOpts(item)"
				v-pnp-dropzone="dragDrop.dropzoneOpts(item)"
			>
				<!-- Icon -->
				<div class="vob-icon-cell__icon">
					<span class="material-icons">{{ iconFor(item) }}</span>
				</div>

				<!-- Rename mode -->
				<input
					v-if="inlineRename.isRenaming(item.id)"
					v-model="inlineRename.renameValue.value"
					class="vob-inline-rename vob-icon-cell__rename"
					v-focus-select
					@blur="inlineRename.commitRename()"
					@keydown="handleRenameKeydown"
					@click.stop
				/>

				<!-- Normal mode -->
				<span v-else class="vob-icon-cell__name">{{ item.name }}</span>
			</div>
		</div>

		<div v-if="currentItems.length === 0" class="vob-icon-empty">
			This folder is empty.
		</div>
	</div>
</template>
