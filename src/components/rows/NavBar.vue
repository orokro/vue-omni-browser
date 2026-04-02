<script setup lang="ts">
/**
 * NavBar.vue
 * Horizontal navigation bar row.
 *
 * Layout (left → right):
 *   [buttons from config] | [breadcrumb / path input — flex:1] | [search toggle]
 *
 * Breadcrumb behaviour:
 *  - virtualRoot label shown first in muted colour (non-clickable, non-navigable)
 *  - Root shown as a home icon or the first empty crumb
 *  - Each path segment is a clickable button
 *  - When allowDuplicateNames is false, clicking the path text area turns it
 *    into an editable input for direct path entry
 *
 * Search:
 *  - Magnifier icon on the far right
 *  - Clicking it expands an input using flex transition
 *  - Typing updates sortFilter.searchQuery
 *  - Pressing Escape collapses it and clears the query
 */

import { ref, computed, inject, nextTick, watch } from 'vue';
import type { VobNavBarRow } from '../../types';
import {
	VOB_ENGINE_KEY,
	VOB_NAVIGATION_KEY,
	VOB_SORT_FILTER_KEY,
	VOB_CONFIG_KEY,
} from '../../injectionKeys';
import VobButton from '../shared/VobButton.vue';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

const props = defineProps<{
	row: VobNavBarRow;
}>();

// ----------------------------------------------------------------
// Injected state
// ----------------------------------------------------------------

const engine     = inject(VOB_ENGINE_KEY)!;
const navigation = inject(VOB_NAVIGATION_KEY)!;
const sortFilter = inject(VOB_SORT_FILTER_KEY)!;
const config     = inject(VOB_CONFIG_KEY)!;

// ----------------------------------------------------------------
// Breadcrumb segments
// ----------------------------------------------------------------

interface Crumb {
	id: string | null; // null = root
	label: string;
	pathIds: string[]; // The path to navigate to when clicking this crumb
}

const crumbs = computed<Crumb[]>(() => {
	const result: Crumb[] = [{ id: null, label: '', pathIds: [] }]; // root
	for (let i = 0; i < navigation.currentPathIds.value.length; i++) {
		const id = navigation.currentPathIds.value[i];
		result.push({
			id,
			label: engine.getItem(id)?.name ?? id,
			pathIds: navigation.currentPathIds.value.slice(0, i + 1),
		});
	}
	return result;
});

const virtualRoot = computed(() => {
	const vr = config.value.virtualRoot;
	if (!vr) return null;
	return typeof vr === 'string' ? { label: vr, icon: undefined } : vr;
});

// ----------------------------------------------------------------
// Path input (direct path entry — disabled when allowDuplicateNames)
// ----------------------------------------------------------------

const pathInputActive = ref(false);
const pathInputValue  = ref('');
const pathInputRef    = ref<HTMLInputElement | null>(null);

function activatePathInput(): void {
	if (config.value.allowDuplicateNames) return;
	pathInputValue.value = navigation.currentPathString.value;
	pathInputActive.value = true;
	nextTick(() => {
		pathInputRef.value?.select();
	});
}

function commitPathInput(): void {
	pathInputActive.value = false;
	if (pathInputValue.value.trim()) {
		navigation.navigateToPath(pathInputValue.value.trim());
	}
}

function cancelPathInput(): void {
	pathInputActive.value = false;
}

function onPathInputKeydown(e: KeyboardEvent): void {
	if (e.key === 'Enter') commitPathInput();
	if (e.key === 'Escape') cancelPathInput();
}

function navigateToCrumb(crumb: Crumb): void {
	navigation.navigateTo(crumb.pathIds);
}

// ----------------------------------------------------------------
// Search
// ----------------------------------------------------------------

const searchActive   = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);

function activateSearch(): void {
	searchActive.value = true;
	nextTick(() => searchInputRef.value?.focus());
}

function collapseSearch(): void {
	searchActive.value = false;
	sortFilter.setSearchQuery('');
}

function onSearchKeydown(e: KeyboardEvent): void {
	if (e.key === 'Escape') collapseSearch();
}

// Clear search when navigating.
watch(navigation.currentFolderId, () => {
	if (searchActive.value) collapseSearch();
});

// ----------------------------------------------------------------
// Bar height style
// ----------------------------------------------------------------

const barStyle = computed(() =>
	props.row.height ? { height: props.row.height } : {},
);
</script>

<template>
	<div
		class="vob-bar vob-navbar"
		:style="barStyle"
		role="toolbar"
		aria-label="Navigation"
	>
		<!-- Left buttons from config -->
		<template v-if="row.buttons?.length">
			<VobButton
				v-for="(entry, i) in row.buttons"
				:key="i"
				:entry="entry"
				compact
			/>
		</template>

		<!-- Breadcrumb / Path area — takes up remaining space -->
		<div class="vob-navbar__path" :class="{ 'vob-navbar__path--search-open': searchActive }">
			<!-- Direct path input (shown instead of crumbs when editing) -->
			<input
				v-if="pathInputActive"
				ref="pathInputRef"
				v-model="pathInputValue"
				class="vob-navbar__path-input"
				type="text"
				@blur="commitPathInput"
				@keydown="onPathInputKeydown"
			/>

			<!-- Breadcrumb trail -->
			<div
				v-else
				class="vob-navbar__crumbs"
				@dblclick="activatePathInput"
			>
				<!-- Virtual root (non-navigable) -->
				<span
					v-if="virtualRoot"
					class="vob-crumb vob-crumb--virtual"
					:title="virtualRoot.label"
				>{{ virtualRoot.label }}</span>
				<span v-if="virtualRoot" class="vob-crumb-sep" aria-hidden="true">/</span>

				<!-- Root crumb -->
				<button
					class="vob-crumb vob-crumb--btn"
					:class="{ 'vob-crumb--active': crumbs.length === 1 }"
					:aria-current="crumbs.length === 1 ? 'page' : undefined"
					title="Root"
					@click="navigation.goToRoot()"
				>
					<span class="material-icons" style="font-size: 14px;" aria-hidden="true">home</span>
				</button>

				<!-- Path segments -->
				<template v-for="(crumb, i) in crumbs.slice(1)" :key="crumb.id">
					<span class="vob-crumb-sep" aria-hidden="true">/</span>
					<button
						class="vob-crumb vob-crumb--btn"
						:class="{ 'vob-crumb--active': i === crumbs.length - 2 }"
						:aria-current="i === crumbs.length - 2 ? 'page' : undefined"
						:title="crumb.label"
						@click="navigateToCrumb(crumb)"
					>
						{{ crumb.label }}
					</button>
				</template>
			</div>
		</div>

		<!-- Search toggle -->
		<div class="vob-navbar__search" :class="{ 'vob-navbar__search--open': searchActive }">
			<input
				v-if="searchActive"
				ref="searchInputRef"
				class="vob-navbar__search-input"
				type="search"
				placeholder="Search…"
				:value="sortFilter.searchQuery.value"
				@input="sortFilter.setSearchQuery(($event.target as HTMLInputElement).value)"
				@keydown="onSearchKeydown"
			/>
			<button
				class="vob-btn vob-navbar__search-btn"
				:class="{ 'vob-navbar__search-btn--active': searchActive }"
				:title="searchActive ? 'Close search' : 'Search'"
				:aria-expanded="searchActive"
				aria-label="Toggle search"
				type="button"
				@click="searchActive ? collapseSearch() : activateSearch()"
			>
				<span class="material-icons" aria-hidden="true">
					{{ searchActive ? 'close' : 'search' }}
				</span>
			</button>
		</div>
	</div>
</template>

<style scoped>
.vob-navbar {
	gap: 2px;
}

/* Path area */
.vob-navbar__path {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: center;
	height: 100%;
	overflow: hidden;
	transition: max-width 0.2s ease;
}

.vob-navbar__path--search-open {
	max-width: 40%;
}

.vob-navbar__path-input {
	flex: 1;
	height: 22px;
	padding: 0 6px;
	background: var(--vob-bg);
	border: 1px solid var(--vob-accent);
	border-radius: var(--vob-border-radius);
	color: var(--vob-text);
	font-size: var(--vob-font-size);
	font-family: var(--vob-font-family);
	outline: none;
	min-width: 0;
}

/* Breadcrumb trail */
.vob-navbar__crumbs {
	display: flex;
	align-items: center;
	flex-wrap: nowrap;
	overflow: hidden;
	gap: 0;
	height: 100%;
	cursor: default;
	min-width: 0;
}

.vob-crumb {
	white-space: nowrap;
	font-size: var(--vob-font-size);
	font-family: var(--vob-font-family);
}

.vob-crumb--virtual {
	color: var(--vob-text-muted);
	padding: 0 4px;
}

.vob-crumb--btn {
	display: inline-flex;
	align-items: center;
	padding: 0 4px;
	height: 22px;
	background: transparent;
	border: none;
	border-radius: var(--vob-border-radius);
	color: var(--vob-text);
	cursor: pointer;
	transition: background 0.1s, color 0.1s;
	max-width: 160px;
	overflow: hidden;
	text-overflow: ellipsis;
}

.vob-crumb--btn:hover {
	background: var(--vob-btn-hover-bg);
	color: var(--vob-accent);
}

.vob-crumb--active {
	color: var(--vob-text);
	font-weight: 500;
	cursor: default;
	pointer-events: none;
}

.vob-crumb-sep {
	color: var(--vob-text-muted);
	padding: 0 1px;
	font-size: 11px;
	flex-shrink: 0;
}

/* Search */
.vob-navbar__search {
	display: flex;
	align-items: center;
	gap: 2px;
	flex-shrink: 0;
}

.vob-navbar__search-input {
	width: 180px;
	height: 22px;
	padding: 0 6px;
	background: var(--vob-bg);
	border: 1px solid var(--vob-accent);
	border-radius: var(--vob-border-radius);
	color: var(--vob-text);
	font-size: var(--vob-font-size);
	font-family: var(--vob-font-family);
	outline: none;

	/* Clear the default search input chrome */
	&::-webkit-search-cancel-button { display: none; }
}

.vob-navbar__search-btn--active {
	color: var(--vob-accent);
}
</style>
