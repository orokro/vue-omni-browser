<script setup lang="ts">
/**
 * ColumnView.vue
 * Finder-style column browser. Each column shows the children of the
 * folder "active" in the previous column.
 *
 * Layout:
 *   Column 0 always shows root-level items.
 *   Clicking a folder in column N:
 *     - Marks it as the "active" item (highlighted in blue).
 *     - Shows its children in column N+1.
 *     - Removes any columns after N+1.
 *
 * Navigation state:
 *   columnParentIds[i] is the parentId used to fetch column i's items.
 *   columnParentIds[0] is always null (root).
 *   The active item in column i is columnParentIds[i + 1] (if it exists).
 *
 *   On every change to columnParentIds, navigation.navigateTo() is called
 *   so that switching away from column view preserves the last active path.
 *
 * Back/Forward/Up nav buttons are disabled in column view (handled by VobButton).
 */

import { computed, ref, watch, nextTick, inject } from 'vue';
import type { VobItem } from '../../types';
import { vFocusSelect } from '@/directives/focusSelect';
import { vPnpDraggable, vPnpDropzone } from 'vue-pick-n-plop';
import {
	VOB_ENGINE_KEY,
	VOB_NAVIGATION_KEY,
	VOB_SELECTION_KEY,
	VOB_SORT_FILTER_KEY,
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
const clipboard    = inject(VOB_CLIPBOARD_KEY)!;
const dataSpec     = inject(VOB_DATA_SPEC_KEY)!;
const inlineRename = inject(VOB_INLINE_RENAME_KEY)!;
const contextMenu  = inject(VOB_CONTEXT_MENU_KEY)!;
const openItem     = inject(VOB_OPEN_ITEM_KEY)!;
const dragDrop     = inject(VOB_DRAG_DROP_KEY)!;

// ----------------------------------------------------------------
// Column state
// ----------------------------------------------------------------

/**
 * The parentId shown in each column.
 *   columnParentIds.value[0] === null  → column 0 shows root items
 *   columnParentIds.value[1] === 'folder-assets' → column 1 shows Assets children
 *   etc.
 *
 * Initialised from the current navigation path so the view is consistent
 * when the user switches to column view mid-session.
 */
function buildInitialColumnIds(): (string | null)[] {
	return [null, ...navigation.currentPathIds.value];
}

const columnParentIds = ref<(string | null)[]>(buildInitialColumnIds());

/** True while we are internally updating navigation to avoid a feedback loop. */
let internalNavUpdate = false;

// ----------------------------------------------------------------
// Sync columnParentIds → navigation
// ----------------------------------------------------------------

/**
 * Whenever the column state changes (user clicked a folder), push the
 * deepest path to the global navigation. This lets Back/Forward and
 * the navigate emit stay consistent.
 */
watch(
	columnParentIds,
	(ids) => {
		if (internalNavUpdate) return;
		// The active path = every entry after the null root, in order.
		const pathIds = ids.slice(1) as string[];
		internalNavUpdate = true;
		navigation.navigateTo(pathIds);
		nextTick(() => { internalNavUpdate = false; });
	},
	{ deep: false },
);

// When the user navigates via Back/Forward (outside the column view while still
// in column view mode — edge case), rebuild the columns from the new path.
watch(
	navigation.currentPathIds,
	(pathIds) => {
		if (internalNavUpdate) return;
		columnParentIds.value = [null, ...pathIds];
	},
	{ deep: false },
);

// ----------------------------------------------------------------
// Column items computation
// ----------------------------------------------------------------

/** Returns the sorted/filtered items for the given parent ID. */
function itemsForColumn(parentId: string | null): VobItem[] {
	return sortFilter.applyToItems(
		engine.getChildren(parentId),
		dataSpec.value,
	);
}

/** The visible columns, each containing their items list. */
const columns = computed<{ parentId: string | null; items: VobItem[] }[]>(() =>
	columnParentIds.value.map((parentId) => ({
		parentId,
		items: itemsForColumn(parentId),
	})),
);

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function iconFor(item: VobItem): string {
	const def = engine.getTypeDefinition(item.type);
	if (def?.icon && typeof def.icon === 'string') return def.icon;
	return def?.hasChildren ? 'folder' : 'insert_drive_file';
}

/**
 * Returns true if `itemId` is the "active" item in column `colIndex`
 * (i.e. it is the parent of the next column).
 */
function isActiveInColumn(itemId: string, colIndex: number): boolean {
	return columnParentIds.value[colIndex + 1] === itemId;
}

// ----------------------------------------------------------------
// Interaction
// ----------------------------------------------------------------

/**
 * Click on an item in column `colIndex`.
 *
 * - For folders: set as active in this column, show its children in colIndex+1.
 * - For leaves: just select the item.
 * - Any columns beyond colIndex+1 are removed.
 */
function handleClick(item: VobItem, colIndex: number, event: MouseEvent): void {
	if (inlineRename.isRenaming(item.id)) return;

	const def = engine.getTypeDefinition(item.type);

	// Selection: use the items of this column as the ordered list.
	const colItems = columns.value[colIndex].items;
	const orderedIds = colItems.map((i) => i.id);
	const mod = event.ctrlKey || event.metaKey ? 'ctrl' : event.shiftKey ? 'shift' : 'none';
	selection.handleClick(item.id, mod, orderedIds);

	if (def?.hasChildren) {
		// Open the next column showing this folder's children.
		// Trim everything beyond colIndex+1, then append the new folder.
		columnParentIds.value = [...columnParentIds.value.slice(0, colIndex + 1), item.id];
	} else {
		// Leaf item — just trim any trailing open columns beyond this column.
		// Keep the current column's parent chain intact up to colIndex.
		columnParentIds.value = columnParentIds.value.slice(0, colIndex + 1);
	}
}

/**
 * Double-click on a folder: same as single click but also navigates into it
 * (sets the nav path) — useful for switching to another view mode later.
 */
function handleDblClick(item: VobItem, colIndex: number): void {
	if (inlineRename.isRenaming(item.id)) return;
	const def = engine.getTypeDefinition(item.type);
	if (def?.hasChildren) {
		// Advance the column panel to show children in the next column.
		columnParentIds.value = [...columnParentIds.value.slice(0, colIndex + 1), item.id];
		selection.clearSelection();
	}
	// Fire onOpen for all item types (after column navigation for containers).
	openItem.openItem(item);
}

// ----------------------------------------------------------------
// Context menu
// ----------------------------------------------------------------

/**
 * Right-click on an item row in a column.
 */
function handleContextMenu(item: VobItem, colIndex: number, event: MouseEvent): void {
	if (inlineRename.isRenaming(item.id)) return;
	// Ensure the item is selected before opening the menu.
	if (!selection.isSelected(item.id)) {
		const colItems = columns.value[colIndex].items;
		selection.handleClick(item.id, 'none', colItems.map((i) => i.id));
	}
	contextMenu.openForItem(item, event);
}

/**
 * Right-click on empty space in a column. The target folder is the column's
 * parentId (the folder whose children are shown in that column).
 */
function handleBgContextMenu(colParentId: string | null, event: MouseEvent): void {
	contextMenu.openForBackground(colParentId, event);
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
	<div class="vob-column-view">
		<div
			v-for="(col, colIndex) in columns"
			:key="colIndex"
			class="vob-column"
			@contextmenu.self.prevent="handleBgContextMenu(col.parentId, $event)"
			v-pnp-dropzone="dragDrop.dropzoneOpts(col.parentId)"
		>
			<!-- Items in this column -->
			<div
				v-for="item in col.items"
				:key="item.id"
				class="vob-column-row"
				:class="{
					'vob-column-row--active':    isActiveInColumn(item.id, colIndex),
					'vob-column-row--selected':  selection.isSelected(item.id) && !isActiveInColumn(item.id, colIndex),
					'vob-column-row--cut':       clipboard.isCut(item.id),
					'vob-column-row--dragging':  dragDrop.isDraggingItem(item.id),
				}"
				v-pnp-draggable="dragDrop.draggableOpts(item)"
				@click="handleClick(item, colIndex, $event)"
				@dblclick="handleDblClick(item, colIndex)"
				@contextmenu.prevent="handleContextMenu(item, colIndex, $event)"
			>
				<span class="material-icons vob-column-row__icon">{{ iconFor(item) }}</span>

				<!-- Rename input -->
				<input
					v-if="inlineRename.isRenaming(item.id)"
					v-model="inlineRename.renameValue.value"
					class="vob-inline-rename vob-column-row__name"
					v-focus-select
					@blur="inlineRename.commitRename()"
					@keydown="handleRenameKeydown"
					@click.stop
				/>

				<!-- Normal name -->
				<span v-else class="vob-column-row__name">{{ item.name }}</span>

				<!-- Chevron for folders with children -->
				<span
					v-if="engine.getTypeDefinition(item.type)?.hasChildren"
					class="material-icons vob-column-row__arrow"
				>
					chevron_right
				</span>
			</div>

			<div v-if="col.items.length === 0" class="vob-column-empty">
				Empty
			</div>
		</div>
	</div>
</template>
