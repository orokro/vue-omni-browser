<script setup lang="ts">
/**
 * ButtonsBar.vue
 * Action buttons bar with view-mode, zoom, and filter controls on the right.
 *
 * Layout (left → right):
 *   [action buttons] [spacer] [type filter] [view mode toggle] [zoom controls]
 *
 * The search input can also live here instead of in NavBar — controlled by which
 * row the user places it in via config. The ButtonsBar does not own search;
 * search is always in NavBar when both rows are present.
 */

import { computed, inject } from 'vue';
import type { VobButtonsBarRow } from '../../types';
import { VOB } from '../../constants';
import type { VobViewMode } from '../../constants';
import {
	VOB_VIEW_MODE_KEY,
	VOB_CONFIG_KEY,
	VOB_DATA_SPEC_KEY,
	VOB_SORT_FILTER_KEY,
} from '../../injectionKeys';
import VobButton from '../shared/VobButton.vue';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

const props = defineProps<{
	row: VobButtonsBarRow;
}>();

// ----------------------------------------------------------------
// Injected state
// ----------------------------------------------------------------

const viewMode   = inject(VOB_VIEW_MODE_KEY)!;
const config     = inject(VOB_CONFIG_KEY)!;
const dataSpec   = inject(VOB_DATA_SPEC_KEY)!;
const sortFilter = inject(VOB_SORT_FILTER_KEY)!;

// ----------------------------------------------------------------
// View mode icons
// ----------------------------------------------------------------

const VIEW_MODE_ICONS: Record<string, string> = {
	[VOB.VIEW_MODES.LIST]:    'view_list',
	[VOB.VIEW_MODES.DETAILS]: 'view_headline',
	[VOB.VIEW_MODES.ICONS]:   'grid_view',
	[VOB.VIEW_MODES.TREE]:    'account_tree',
	[VOB.VIEW_MODES.COLUMNS]: 'view_column',
};

const VIEW_MODE_LABELS: Record<string, string> = {
	[VOB.VIEW_MODES.LIST]:    'List',
	[VOB.VIEW_MODES.DETAILS]: 'Details',
	[VOB.VIEW_MODES.ICONS]:   'Icons',
	[VOB.VIEW_MODES.TREE]:    'Tree',
	[VOB.VIEW_MODES.COLUMNS]: 'Columns',
};

// ----------------------------------------------------------------
// Filter options — derived from dataSpec types
// ----------------------------------------------------------------

const filterOptions = computed(() => {
	const rowFilters = props.row.filterSettings?.availableFilters;
	if (rowFilters && rowFilters.length > 0) {
		return rowFilters.map((slug) => ({
			slug,
			label: dataSpec.value.types.find((t) => t.slug === slug)?.label ?? slug,
		}));
	}
	return dataSpec.value.types.map((t) => ({ slug: t.slug, label: t.label ?? t.slug }));
});

// ----------------------------------------------------------------
// Zoom
// ----------------------------------------------------------------

const showZoom = computed(() =>
	!!props.row.zoomSettings && viewMode.viewMode.value === VOB.VIEW_MODES.ICONS,
);

const zoomPercent = computed(() => Math.round(viewMode.zoom.value * 100));

// ----------------------------------------------------------------
// Bar height style
// ----------------------------------------------------------------

const barStyle = computed(() =>
	props.row.height ? { height: props.row.height } : {},
);
</script>

<template>
	<div
		class="vob-bar vob-buttons-bar"
		:style="barStyle"
		role="toolbar"
		aria-label="Actions"
	>
		<!-- Left: action buttons -->
		<template v-if="row.buttons?.length">
			<VobButton
				v-for="(entry, i) in row.buttons"
				:key="i"
				:entry="entry"
				compact
			/>
		</template>

		<!-- Spacer -->
		<div class="vob-buttons-bar__spacer" />

		<!-- Type filter dropdown -->
		<div v-if="filterOptions.length > 1" class="vob-buttons-bar__filter">
			<select
				class="vob-select"
				:value="sortFilter.activeTypeFilter.value ?? ''"
				:title="`Filter by type (${sortFilter.activeTypeFilter.value ?? 'all'})`"
				aria-label="Filter by type"
				@change="sortFilter.setTypeFilter(($event.target as HTMLSelectElement).value || null)"
			>
				<option value="">All types</option>
				<option
					v-for="opt in filterOptions"
					:key="opt.slug"
					:value="opt.slug"
				>{{ opt.label }}</option>
			</select>
		</div>

		<!-- View mode toggle buttons -->
		<div
			v-if="row.viewModeSettings"
			class="vob-buttons-bar__view-modes"
			role="group"
			aria-label="View mode"
		>
			<button
				v-for="mode in viewMode.availableViewModes.value"
				:key="mode"
				class="vob-btn vob-view-btn"
				:class="{ 'vob-view-btn--active': viewMode.viewMode.value === mode }"
				:title="VIEW_MODE_LABELS[mode] ?? mode"
				:aria-pressed="viewMode.viewMode.value === mode"
				:aria-label="`View: ${VIEW_MODE_LABELS[mode] ?? mode}`"
				type="button"
				@click="viewMode.setViewMode(mode as VobViewMode)"
			>
				<span class="material-icons" aria-hidden="true">{{ VIEW_MODE_ICONS[mode] ?? 'view_list' }}</span>
			</button>
		</div>

		<!-- Zoom controls (icons view only) -->
		<div
			v-if="showZoom"
			class="vob-buttons-bar__zoom"
			aria-label="Zoom"
		>
			<button
				class="vob-btn"
				title="Zoom out"
				aria-label="Zoom out"
				type="button"
				:disabled="viewMode.zoom.value <= viewMode.minZoom.value"
				@click="viewMode.zoomOut()"
			>
				<span class="material-icons" aria-hidden="true">zoom_out</span>
			</button>
			<span class="vob-buttons-bar__zoom-label" :title="`Zoom: ${zoomPercent}%`">
				{{ zoomPercent }}%
			</span>
			<button
				class="vob-btn"
				title="Zoom in"
				aria-label="Zoom in"
				type="button"
				:disabled="viewMode.zoom.value >= viewMode.maxZoom.value"
				@click="viewMode.zoomIn()"
			>
				<span class="material-icons" aria-hidden="true">zoom_in</span>
			</button>
		</div>
	</div>
</template>

<style scoped>
.vob-buttons-bar__spacer {
	flex: 1;
}

.vob-buttons-bar__filter {
	display: flex;
	align-items: center;
}

.vob-select {
	height: 22px;
	padding: 0 4px;
	background: var(--vob-bg);
	border: 1px solid var(--vob-border);
	border-radius: var(--vob-border-radius);
	color: var(--vob-text);
	font-size: var(--vob-font-size);
	font-family: var(--vob-font-family);
	cursor: pointer;
	outline: none;

	&:focus {
		border-color: var(--vob-accent);
	}
}

.vob-buttons-bar__view-modes {
	display: flex;
	align-items: center;
	gap: 0;
	border: 1px solid var(--vob-border);
	border-radius: var(--vob-border-radius);
	overflow: hidden;
	height: 24px;
}

.vob-view-btn {
	height: 100%;
	padding: 0 6px;
	border-radius: 0;
	border-right: 1px solid var(--vob-border);
	color: var(--vob-text-muted);

	&:last-child {
		border-right: none;
	}

	&:hover:not(.vob-view-btn--active) {
		background: var(--vob-btn-hover-bg);
		color: var(--vob-text);
	}
}

.vob-view-btn--active {
	background: var(--vob-accent) !important;
	color: var(--vob-text-on-accent) !important;
}

.vob-buttons-bar__zoom {
	display: flex;
	align-items: center;
	gap: 2px;
}

.vob-buttons-bar__zoom-label {
	font-size: 11px;
	color: var(--vob-text-muted);
	min-width: 34px;
	text-align: center;
	font-variant-numeric: tabular-nums;
}
</style>
