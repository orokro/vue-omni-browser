<script setup lang="ts">
/**
 * TreeView.vue
 * Renders the full item hierarchy as an indented, expand/collapse tree.
 *
 * Unlike the other views, TreeView shows ALL items from the root — not just
 * the current folder — so navigation state is not directly used for filtering.
 * Clicking a folder navigates to it and highlights it; clicking a leaf selects it.
 *
 * Expand/collapse state is local to the component instance. No virtualization
 * is applied; this view is intended for datasets in the hundreds of items range.
 */

import { computed, ref, inject } from 'vue';
import type { VobItem } from '../../types';
import { buildTreeRows, type TreeViewRow } from '../../utils/treeUtils';
import { vFocusSelect } from '@/directives/focusSelect';
import { vPnpDraggable, vPnpDropzone } from 'vue-pick-n-plop';
import {
	VOB_ENGINE_KEY,
	VOB_NAVIGATION_KEY,
	VOB_SELECTION_KEY,
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
const clipboard    = inject(VOB_CLIPBOARD_KEY)!;
const dataSpec     = inject(VOB_DATA_SPEC_KEY)!;
const inlineRename = inject(VOB_INLINE_RENAME_KEY)!;
const contextMenu  = inject(VOB_CONTEXT_MENU_KEY)!;
const openItem     = inject(VOB_OPEN_ITEM_KEY)!;
const dragDrop     = inject(VOB_DRAG_DROP_KEY)!;

// ----------------------------------------------------------------
// Expand / collapse state
// ----------------------------------------------------------------

const expandedIds = ref<Set<string>>(new Set());

/**
 * Set of type slugs where hasChildren === true.
 * Pre-computed so buildTreeRows doesn't need to re-scan the dataSpec per row.
 */
const hasChildrenSet = computed<Set<string>>(() => {
	const s = new Set<string>();
	for (const t of dataSpec.value.types) {
		if (t.hasChildren) s.add(t.slug);
	}
	return s;
});

// ----------------------------------------------------------------
// Visible rows
// ----------------------------------------------------------------

/**
 * Pre-computed flat array of rows produced by a pre-order traversal of
 * the registry, respecting expandedIds. Recomputed whenever the registry
 * version changes or expandedIds changes.
 */
const treeRows = computed<TreeViewRow[]>(() =>
	buildTreeRows(
		engine.registry.value,
		expandedIds.value,
		hasChildrenSet.value,
		engine.rootIds.value,
	),
);

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function iconFor(item: VobItem): string {
	const def = engine.getTypeDefinition(item.type);
	if (def?.icon && typeof def.icon === 'string') return def.icon;
	return def?.hasChildren ? 'folder' : 'insert_drive_file';
}

/** Returns the pixel indent for the given depth. */
function indentWidth(depth: number): string {
	return `calc(${depth} * var(--vob-indent-width, 20px))`;
}

// ----------------------------------------------------------------
// Interaction
// ----------------------------------------------------------------

/**
 * Click on the expand/collapse toggle chevron.
 * Stops propagation so it doesn't also trigger item selection.
 */
function handleToggle(item: VobItem, event: MouseEvent): void {
	event.stopPropagation();
	const next = new Set(expandedIds.value);
	if (next.has(item.id)) {
		next.delete(item.id);
	} else {
		next.add(item.id);
	}
	expandedIds.value = next;
}

/** Click on a row: select the item and (for folders) navigate to it. */
function handleClick(row: TreeViewRow, event: MouseEvent): void {
	if (inlineRename.isRenaming(row.item.id)) return;
	const visibleIds = treeRows.value.map((r) => r.item.id);
	const mod = event.ctrlKey || event.metaKey ? 'ctrl' : event.shiftKey ? 'shift' : 'none';
	selection.handleClick(row.item.id, mod, visibleIds);
}

/**
 * Double-click: for folders, toggle expansion AND navigate to the folder.
 */
function handleDblClick(row: TreeViewRow): void {
	if (inlineRename.isRenaming(row.item.id)) return;
	openItem.openItem(row.item);
}

// ----------------------------------------------------------------
// Context menu
// ----------------------------------------------------------------

/**
 * Right-click on a tree row.
 */
function handleContextMenu(row: TreeViewRow, event: MouseEvent): void {
	if (inlineRename.isRenaming(row.item.id)) return;
	contextMenu.openForItem(row.item, event);
}

/**
 * Right-click on empty space in the tree view.
 * Use the current navigation folder as the target (tree shows the whole tree,
 * so "background" paste/new-folder targets the currently navigated folder).
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
		event.stopPropagation(); // Prevent global keyboard handler from acting on Enter after rename commits.
		inlineRename.commitRename();
	} else if (event.key === 'Escape') {
		event.preventDefault();
		event.stopPropagation();
		inlineRename.cancelRename();
	}
}
</script>

<template>
	<div
		class="vob-tree-view"
		@contextmenu.self.prevent="handleBgContextMenu($event)"
	@click.self="selection.clearSelection()"
		v-pnp-dropzone="dragDrop.dropzoneOpts(navigation.currentFolderId.value)"
	>
		<div
			v-for="row in treeRows"
			:key="row.item.id"
			class="vob-tree-row"
			:class="{
				'vob-tree-row--selected': selection.isSelected(row.item.id),
				'vob-tree-row--cut':      clipboard.isCut(row.item.id),
				'vob-tree-row--dragging': dragDrop.isDraggingItem(row.item.id),
			}"
			v-pnp-draggable="dragDrop.draggableOpts(row.item)"
			v-pnp-dropzone="dragDrop.dropzoneOpts(row.item)"
			@click="handleClick(row, $event)"
			@dblclick="handleDblClick(row)"
			@contextmenu.prevent="handleContextMenu(row, $event)"
		>
			<!-- Left indentation spacer -->
			<span class="vob-tree-indent" :style="{ width: indentWidth(row.depth) }" />

			<!-- Expand/collapse toggle -->
			<span
				class="material-icons vob-tree-toggle"
				:class="{ 'vob-tree-toggle--leaf': !row.hasChildren }"
				@click="row.hasChildren ? handleToggle(row.item, $event) : undefined"
			>
				{{ row.hasChildren ? (row.isExpanded ? 'expand_more' : 'chevron_right') : '' }}
			</span>

			<!-- Item icon -->
			<span class="material-icons vob-tree-icon">{{ iconFor(row.item) }}</span>

			<!-- Rename input -->
			<input
				v-if="inlineRename.isRenaming(row.item.id)"
				v-model="inlineRename.renameValue.value"
				class="vob-inline-rename vob-tree-name"
				v-focus-select
				@blur="inlineRename.commitRename()"
				@keydown="handleRenameKeydown"
				@click.stop
			/>

			<!-- Normal name -->
			<span v-else class="vob-tree-name">{{ row.item.name }}</span>
		</div>

		<div v-if="treeRows.length === 0" class="vob-tree-empty">
			No items.
		</div>
	</div>
</template>
