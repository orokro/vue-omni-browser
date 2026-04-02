<script setup lang="ts">
/**
 * ContentArea.vue
 * Switches between the five content views based on the active view mode.
 *
 * Phase 2 stub: renders a placeholder with current state info so the
 * layout can be validated before the views are built in Phase 3.
 *
 * Phase 3 will swap the placeholder for:
 *   <ListView>    → list / details
 *   <IconView>    → icons
 *   <TreeView>    → tree
 *   <ColumnView>  → columns
 */

import { computed, inject } from 'vue';
import { VOB } from '../../constants';
import {
	VOB_ENGINE_KEY,
	VOB_NAVIGATION_KEY,
	VOB_SELECTION_KEY,
	VOB_VIEW_MODE_KEY,
	VOB_SORT_FILTER_KEY,
	VOB_DATA_SPEC_KEY,
} from '../../injectionKeys';

const engine     = inject(VOB_ENGINE_KEY)!;
const navigation = inject(VOB_NAVIGATION_KEY)!;
const selection  = inject(VOB_SELECTION_KEY)!;
const viewMode   = inject(VOB_VIEW_MODE_KEY)!;
const sortFilter = inject(VOB_SORT_FILTER_KEY)!;
const dataSpec   = inject(VOB_DATA_SPEC_KEY)!;

const currentItems = computed(() =>
	sortFilter.applyToItems(
		engine.getChildren(navigation.currentFolderId.value),
		dataSpec.value,
	),
);

/** Handle double-click on an item — navigates into folders. */
function handleDblClick(id: string): void {
	const item = engine.getItem(id);
	if (!item) return;
	const typeDef = engine.getTypeDefinition(item.type);
	if (typeDef?.hasChildren) {
		navigation.navigateTo([...navigation.currentPathIds.value, id]);
		selection.clearSelection();
	}
}
</script>

<template>
	<div class="vob-content-area vob-content-stub">
		<!-- Phase 3 placeholder — replace with view components -->
		<div class="vob-content-stub__header">
			<span class="material-icons">{{ {
				[VOB.VIEW_MODES.LIST]:    'view_list',
				[VOB.VIEW_MODES.DETAILS]: 'view_headline',
				[VOB.VIEW_MODES.ICONS]:   'grid_view',
				[VOB.VIEW_MODES.TREE]:    'account_tree',
				[VOB.VIEW_MODES.COLUMNS]: 'view_column',
			}[viewMode.viewMode.value] ?? 'view_list' }}</span>
			<strong>{{ viewMode.viewMode.value }}</strong> view
			<span class="vob-content-stub__sub">(Phase 3 placeholder)</span>
		</div>

		<ul class="vob-content-stub__list">
			<li
				v-for="item in currentItems"
				:key="item.id"
				class="vob-content-stub__item"
				:class="{
					'vob-content-stub__item--selected': selection.isSelected(item.id),
					'vob-content-stub__item--cut': false,
				}"
				@click="selection.handleClick(item.id, $event.ctrlKey ? 'ctrl' : $event.shiftKey ? 'shift' : 'none', currentItems.map(i => i.id))"
				@dblclick="handleDblClick(item.id)"
			>
				<span class="material-icons vob-content-stub__icon">
					{{ engine.getTypeDefinition(item.type)?.hasChildren ? 'folder' : 'insert_drive_file' }}
				</span>
				<span class="vob-content-stub__name">{{ item.name }}</span>
				<span v-if="engine.getTypeDefinition(item.type)?.hasChildren" class="vob-content-stub__hint">↩ open</span>
			</li>
			<li v-if="currentItems.length === 0" class="vob-content-stub__empty">
				(empty)
			</li>
		</ul>
	</div>
</template>

<style scoped>
.vob-content-stub {
	padding: 12px;
	font-size: var(--vob-font-size);
	color: var(--vob-text);
	overflow-y: auto;
}

.vob-content-stub__header {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 4px 0 10px;
	border-bottom: 1px solid var(--vob-border);
	margin-bottom: 8px;
	color: var(--vob-text-muted);
	font-size: 12px;
}

.vob-content-stub__sub {
	font-style: italic;
	font-size: 11px;
}

.vob-content-stub__list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 1px;
}

.vob-content-stub__item {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 3px 6px;
	border-radius: var(--vob-border-radius);
	cursor: pointer;
	user-select: none;

	&:nth-child(even) { background: var(--vob-row-odd); }
	&:hover { background: var(--vob-row-hover); }
}

.vob-content-stub__item--selected {
	background: var(--vob-row-selected) !important;
	outline: 1px solid var(--vob-selection-border);
	outline-offset: -1px;
}

.vob-content-stub__icon {
	font-size: 16px;
	color: var(--vob-accent);
	flex-shrink: 0;
}

.vob-content-stub__name {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.vob-content-stub__hint {
	font-size: 10px;
	color: var(--vob-text-muted);
}

.vob-content-stub__empty {
	color: var(--vob-text-muted);
	font-style: italic;
	padding: 12px 6px;
}
</style>
