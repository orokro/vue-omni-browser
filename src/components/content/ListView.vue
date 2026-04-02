<script setup lang="ts">
/**
 * ListView.vue
 * Renders the current folder's items in either list or details mode.
 *
 * List mode   — single-column list with icon + name.
 * Details mode — multi-column table with sortable headers and metadata.
 *
 * Both modes share click/double-click handling, inline rename, and
 * cut-item dimming. The active mode is read from the injected view-mode state.
 */

import { computed, inject } from 'vue';
import type { VobItem, VobMetaKeyDefinition } from '../../types';
import { VOB } from '../../constants';
import {
	VOB_ENGINE_KEY,
	VOB_NAVIGATION_KEY,
	VOB_SELECTION_KEY,
	VOB_SORT_FILTER_KEY,
	VOB_VIEW_MODE_KEY,
	VOB_CLIPBOARD_KEY,
	VOB_DATA_SPEC_KEY,
	VOB_INLINE_RENAME_KEY,
} from '../../injectionKeys';

// ----------------------------------------------------------------
// Injected state
// ----------------------------------------------------------------

const engine      = inject(VOB_ENGINE_KEY)!;
const navigation  = inject(VOB_NAVIGATION_KEY)!;
const selection   = inject(VOB_SELECTION_KEY)!;
const sortFilter  = inject(VOB_SORT_FILTER_KEY)!;
const viewMode    = inject(VOB_VIEW_MODE_KEY)!;
const clipboard   = inject(VOB_CLIPBOARD_KEY)!;
const dataSpec    = inject(VOB_DATA_SPEC_KEY)!;
const inlineRename = inject(VOB_INLINE_RENAME_KEY)!;

// ----------------------------------------------------------------
// Current items
// ----------------------------------------------------------------

const currentItems = computed<VobItem[]>(() =>
	sortFilter.applyToItems(
		engine.getChildren(navigation.currentFolderId.value),
		dataSpec.value,
	),
);

const orderedIds = computed<string[]>(() => currentItems.value.map((i) => i.id));

const isDetailsMode = computed(() => viewMode.viewMode.value === VOB.VIEW_MODES.DETAILS);

// ----------------------------------------------------------------
// Metadata columns (details mode only)
// ----------------------------------------------------------------

interface MetaColumn {
	/** Unique key used for sorting. */
	key: string;
	/** Header label. */
	label: string;
	/** Returns the display string for a given item. */
	getValue: (item: VobItem) => string;
}

/**
 * Derives the set of metadata columns to show.
 * Merges metaKeys from all type definitions present in the current items.
 * String entries use the key as the label; VobMetaKeyDefinition entries use columnName.
 */
const metaColumns = computed<MetaColumn[]>(() => {
	const cols: MetaColumn[] = [];
	const seen = new Set<string>();

	// Collect metaKeys from every type definition in the data spec.
	for (const typeDef of dataSpec.value.types) {
		for (const mk of typeDef.metaKeys ?? []) {
			if (typeof mk === 'string') {
				if (seen.has(mk) || mk === 'name') continue;
				seen.add(mk);
				cols.push({
					key: mk,
					label: mk.charAt(0).toUpperCase() + mk.slice(1),
					getValue: (item: VobItem) => String(item[mk] ?? ''),
				});
			} else {
				const mkDef = mk as VobMetaKeyDefinition;
				const colKey = mkDef.key ?? mkDef.columnName;
				if (seen.has(colKey)) continue;
				seen.add(colKey);
				cols.push({
					key: colKey,
					label: mkDef.columnName,
					getValue: (item: VobItem) => String(mkDef.get(item) ?? ''),
				});
			}
		}
	}

	return cols;
});

// ----------------------------------------------------------------
// Sort header interaction
// ----------------------------------------------------------------

/**
 * Clicks on a details header cell to sort by that column.
 * Delegates to useSortFilter's setSortKey (toggles direction if same key).
 */
function handleHeaderClick(key: string): void {
	sortFilter.setSortKey(key);
}

/**
 * Icon to show next to the active sort column header.
 */
function sortIcon(key: string): string {
	if (sortFilter.sortKey.value !== key) return '';
	return sortFilter.sortDirection.value === 'asc' ? 'arrow_upward' : 'arrow_downward';
}

// ----------------------------------------------------------------
// Item interaction
// ----------------------------------------------------------------

/** Returns the icon string for an item based on its type definition. */
function iconFor(item: VobItem): string {
	const def = engine.getTypeDefinition(item.type);
	if (def?.icon && typeof def.icon === 'string') return def.icon;
	return def?.hasChildren ? 'folder' : 'insert_drive_file';
}

/**
 * Click on an item row: delegates to selection composable with the
 * appropriate modifier ('none', 'ctrl', or 'shift').
 */
function handleClick(item: VobItem, event: MouseEvent): void {
	// Do not handle selection click while renaming this item.
	if (inlineRename.isRenaming(item.id)) return;
	const mod = event.ctrlKey || event.metaKey ? 'ctrl' : event.shiftKey ? 'shift' : 'none';
	selection.handleClick(item.id, mod, orderedIds.value);
}

/**
 * Double-click: navigate into folders, no-op on leaf items.
 */
function handleDblClick(item: VobItem): void {
	if (inlineRename.isRenaming(item.id)) return;
	const def = engine.getTypeDefinition(item.type);
	if (def?.hasChildren) {
		navigation.navigateTo([...navigation.currentPathIds.value, item.id]);
		selection.clearSelection();
	}
}

// ----------------------------------------------------------------
// Inline rename
// ----------------------------------------------------------------

/**
 * Handle keydown on rename input: Enter commits, Escape cancels.
 */
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
	<div class="vob-list-view">
		<!-- Details mode: sortable header row -->
		<div v-if="isDetailsMode" class="vob-list-header">
			<div
				class="vob-list-header__cell vob-list-header__cell--name"
				@click="handleHeaderClick('name')"
			>
				Name
				<span v-if="sortIcon('name')" class="material-icons vob-sort-icon">
					{{ sortIcon('name') }}
				</span>
			</div>
			<div
				v-for="col in metaColumns"
				:key="col.key"
				class="vob-list-header__cell vob-list-header__cell--meta"
				@click="handleHeaderClick(col.key)"
			>
				{{ col.label }}
				<span v-if="sortIcon(col.key)" class="material-icons vob-sort-icon">
					{{ sortIcon(col.key) }}
				</span>
			</div>
		</div>

		<!-- Scrollable body -->
		<div class="vob-list-body">
			<div
				v-for="item in currentItems"
				:key="item.id"
				class="vob-list-row"
				:class="{
					'vob-list-row--selected': selection.isSelected(item.id),
					'vob-list-row--cut':      clipboard.isCut(item.id),
					'vob-list-row--renaming': inlineRename.isRenaming(item.id),
				}"
				@click="handleClick(item, $event)"
				@dblclick="handleDblClick(item)"
			>
				<!-- Name cell (always present) -->
				<div class="vob-list-cell vob-list-cell--name">
					<span class="material-icons vob-list-icon">{{ iconFor(item) }}</span>

					<!-- Rename mode: show input -->
					<input
						v-if="inlineRename.isRenaming(item.id)"
						v-model="inlineRename.renameValue.value"
						class="vob-inline-rename"
						autofocus
						@blur="inlineRename.commitRename()"
						@keydown="handleRenameKeydown"
						@click.stop
					/>

					<!-- Normal mode: show name -->
					<span v-else class="vob-list-name">{{ item.name }}</span>
				</div>

				<!-- Meta cells (details mode only) -->
				<template v-if="isDetailsMode">
					<div
						v-for="col in metaColumns"
						:key="col.key"
						class="vob-list-cell vob-list-cell--meta"
					>
						{{ col.getValue(item) }}
					</div>
				</template>
			</div>

			<div v-if="currentItems.length === 0" class="vob-list-empty">
				This folder is empty.
			</div>
		</div>
	</div>
</template>
