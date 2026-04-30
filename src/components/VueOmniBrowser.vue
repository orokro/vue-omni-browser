<script setup lang="ts">
/**
 * VueOmniBrowser.vue
 * The root component. Orchestrates the layout shell and provides all
 * shared state to child components via Vue's provide/inject system.
 *
 * Responsibilities:
 *  - Accept :config, :data-spec, :data, :theme props
 *  - Initialise all composables and provide them to the tree
 *  - Render rows from config.rows in declared order
 *  - Apply the :theme prop as CSS custom properties on the root element
 *  - Manage the global loading overlay
 *  - Expose the VobApi via defineExpose
 *  - Load the Material Icons font (bundled via material-icons npm package)
 */

import { ref, computed, provide, watch, type Ref } from 'vue';
import type {
	VobConfig,
	VobDataSpec,
	VobHierarchicalItemInput,
	VobFlatItemInput,
	VobTheme,
	VobApi,
	VobItem,
} from '../types';
import { VOB, type VobViewMode } from '../constants';
import { useVobEngine } from '../core/useVobEngine';
import { useNavigation } from '../core/useNavigation';
import { useSelection } from '../core/useSelection';
import { useSortFilter } from '../core/useSortFilter';
import { useViewMode } from '../core/useViewMode';
import { useClipboard } from '../core/useClipboard';
import { useInlineRename } from '../core/useInlineRename';
import { useVobModal } from '../core/useVobModal';
import { useContextMenu } from '../core/useContextMenu';
import { useKeyboardShortcuts } from '../core/useKeyboardShortcuts';
import { useOpenItem } from '../core/useOpenItem';
import { useDragDrop } from '../core/useDragDrop';
import { PNPDragLayer } from 'vue-pick-n-plop';
import {
	VOB_ENGINE_KEY,
	VOB_NAVIGATION_KEY,
	VOB_SELECTION_KEY,
	VOB_SORT_FILTER_KEY,
	VOB_VIEW_MODE_KEY,
	VOB_CLIPBOARD_KEY,
	VOB_CONFIG_KEY,
	VOB_DATA_SPEC_KEY,
	VOB_INLINE_RENAME_KEY,
	VOB_MODAL_KEY,
	VOB_CONTEXT_MENU_KEY,
	VOB_THEME_KEY,
	VOB_OPEN_ITEM_KEY,
	VOB_DRAG_DROP_KEY,
} from '../injectionKeys';
import NavBar from './rows/NavBar.vue';
import ButtonsBar from './rows/ButtonsBar.vue';
import StatusBar from './rows/StatusBar.vue';
import CustomBar from './rows/CustomBar.vue';
import ContentArea from './content/ContentArea.vue';
import VobModal from './VobModal.vue';
import VobContextMenu from './VobContextMenu.vue';

import '../styles/main.scss';
// Material Icons font — bundled locally via the material-icons npm package.
// The font files only download from the user's server when the browser actually
// encounters a .material-icons element, so there's no cost when icons aren't used.
// The enableMaterialIcons config flag controls rendering in VobIcon.vue, not loading.
import 'material-icons/iconfont/material-icons.css';

// ----------------------------------------------------------------
// Props & emits
// ----------------------------------------------------------------

const props = withDefaults(defineProps<{
	config?: VobConfig;
	dataSpec?: VobDataSpec;
	data?: VobHierarchicalItemInput[] | VobFlatItemInput[];
	theme?: VobTheme | 'light' | 'dark';
	/**
	 * Optional stable identifier for this browser instance.
	 * Surfaced in VobDragContext.sourceInstanceId so external drop zones can
	 * distinguish which browser a drag originated from when multiple instances
	 * share the same page.
	 */
	instanceId?: string;

	// ------------------------------------------------------------
	// Controlled chrome props — let a host wrap VOB with its own
	// search box / view-mode picker / type-filter dropdown and
	// drive the internal state through props instead of the built-
	// in chrome rows. Each is bidirectional via Vue 3 named
	// v-model: the prop seeds + tracks state, and the
	// matching `update:<prop>` event fires whenever VOB changes
	// the value internally (e.g. user picks a view mode from the
	// context menu). Hosts can use plain props for a one-way
	// controlled binding, or v-model:viewMode etc. for two-way.
	// ------------------------------------------------------------

	/**
	 * Live search query text. When non-empty, items are filtered to
	 * those whose name contains this string (case-insensitive).
	 * Combine with `recursiveSearch` to search across the whole
	 * dataset rather than just the current folder.
	 */
	searchQuery?: string;

	/**
	 * If true, search applies across every item in the registry —
	 * not just the children of the current folder. Useful for a
	 * Blender-style "search the whole library" toggle.
	 *
	 * NOTE: the prop is plumbed end-to-end on the API surface but
	 * the actual recursive read at render-time will be wired in a
	 * follow-up; for now the value lives on `sortFilter` so a
	 * future view-level read can opt into it. Listed here so host
	 * UIs can be built against the final API shape.
	 */
	recursiveSearch?: boolean;

	/** Active view mode (`'list' | 'details' | 'icons' | 'tree' | 'columns'`). */
	viewMode?: VobViewMode;

	/**
	 * Active type-filter slug. Items whose `type` doesn't match are
	 * hidden. Pass `null` (the default) to show every type.
	 */
	typeFilter?: string | null;

	/**
	 * Currently selected item IDs. Use as a one-way prop to drive
	 * selection externally (e.g. "select-all-by-name" feature in
	 * a host toolbar) or as a Vue 3 named v-model
	 * (`v-model:selection="..."`) to subscribe reactively to the
	 * user's in-VOB selection — typically wired into a host's
	 * Inspector / properties panel so it can show metadata for
	 * whatever the user just clicked on.
	 *
	 * The matching `update:selection` event is also fired with a
	 * second payload — the resolved `VobItem[]` — so non-v-model
	 * listeners can grab the rich items without a second lookup.
	 */
	selection?: string[];
}>(), {
	config: () => ({}),
	dataSpec: () => ({ types: [] }),
	data: () => [],
	theme: 'dark',
	instanceId: undefined,
	// `undefined` (not the default empty value) so we can
	// distinguish "host left it alone" from "host explicitly set
	// it to empty". The watchers below only sync inward when the
	// prop is explicitly set.
	searchQuery: undefined,
	recursiveSearch: undefined,
	viewMode: undefined,
	typeFilter: undefined,
	selection: undefined,
});

const emit = defineEmits<{
	/** Emitted when the internal data changes (create, delete, rename, paste). */
	onDataChanged: [data: VobItem[]];
	/** Emitted when the active path changes. */
	navigate: [pathIds: string[], pathString: string];
	/** Emitted when a new item is created. */
	onCreate: [item: VobItem];
	/** Emitted when items are deleted. */
	onDelete: [items: VobItem[]];
	/** Emitted when an item is renamed. */
	onRename: [item: VobItem, newName: string, oldName: string];
	/** Emitted when items are moved to a new parent. */
	onMove: [items: VobItem[], targetFolderId: string | null];

	// v-model:<prop> companion emits — fired when VOB changes the
	// corresponding state internally (user types in the built-in
	// search input, picks a view mode from the context menu, etc.)
	// so a host doing two-way binding stays in sync.
	'update:searchQuery':     [value: string];
	'update:recursiveSearch': [value: boolean];
	'update:viewMode':        [value: VobViewMode];
	'update:typeFilter':      [value: string | null];
	/**
	 * Selection-changed event. The first payload (the ID array)
	 * satisfies Vue's v-model contract; the second payload is the
	 * resolved `VobItem[]` so non-v-model listeners can grab rich
	 * items without re-looking-them-up.
	 */
	'update:selection':       [ids: string[], items: VobItem[]];
}>();

// ----------------------------------------------------------------
// Normalised reactive prop refs
// The composables need stable Refs, so we wrap the props.
// ----------------------------------------------------------------

const configRef    = computed<VobConfig>(() => props.config ?? {});
const dataSpecRef  = computed<VobDataSpec>(() => props.dataSpec ?? { types: [] });
const dataRef      = ref<VobHierarchicalItemInput[] | VobFlatItemInput[]>(props.data ?? []);

// Keep dataRef in sync when the prop changes externally.
watch(() => props.data, (newData) => {
	dataRef.value = newData ?? [];
}, { deep: false }); // shallow — the engine does its own deep watch

// ----------------------------------------------------------------
// Initialise composables
// ----------------------------------------------------------------

const engine       = useVobEngine(configRef as Ref<VobConfig>, dataSpecRef as Ref<VobDataSpec>, dataRef);
const navigation   = useNavigation(engine, configRef as Ref<VobConfig>);
const selection    = useSelection(engine, configRef as Ref<VobConfig>);
const sortFilter   = useSortFilter();
const viewMode     = useViewMode(configRef as Ref<VobConfig>);

// ----------------------------------------------------------------
// Controlled chrome props ↔ internal state (bidirectional)
// ----------------------------------------------------------------
//
// Each controlled prop pairs an inward sync (prop → state) with an
// outward sync (state → emit). The "values differ" guard inside
// each watcher is what prevents the two from echo-pinging each
// other forever: once they're in sync, neither watcher re-fires.
//
// Hosts can use these as plain one-way controlled props (set the
// prop, ignore the emit) OR as Vue 3 named v-models
// (`v-model:viewMode="..."`) for two-way binding when the user
// changes state via in-VOB controls (context menu, keyboard, etc.).

// searchQuery
watch(() => props.searchQuery, (val) => {
	if (val !== undefined && val !== sortFilter.searchQuery.value) {
		sortFilter.setSearchQuery(val);
	}
}, { immediate: true });
watch(sortFilter.searchQuery, (val) => {
	if (val !== props.searchQuery) emit('update:searchQuery', val);
});

// recursiveSearch
watch(() => props.recursiveSearch, (val) => {
	if (val !== undefined && val !== sortFilter.recursiveSearch.value) {
		sortFilter.setRecursiveSearch(val);
	}
}, { immediate: true });
watch(sortFilter.recursiveSearch, (val) => {
	if (val !== props.recursiveSearch) emit('update:recursiveSearch', val);
});

// viewMode
watch(() => props.viewMode, (val) => {
	if (val !== undefined && val !== viewMode.viewMode.value) {
		viewMode.setViewMode(val);
	}
}, { immediate: true });
watch(viewMode.viewMode, (val) => {
	if (val !== props.viewMode) emit('update:viewMode', val);
});

// typeFilter
watch(() => props.typeFilter, (val) => {
	if (val !== undefined && val !== sortFilter.activeTypeFilter.value) {
		sortFilter.setTypeFilter(val);
	}
}, { immediate: true });
watch(sortFilter.activeTypeFilter, (val) => {
	if (val !== props.typeFilter) emit('update:typeFilter', val);
});

// selection — bidirectional. The "values differ" guard works on
// content equality (two arrays with the same ids in the same
// order are considered equal) so a host re-feeding an emitted
// array doesn't echo. We compare via length + every() rather
// than reference identity since both sides are likely to allocate
// fresh arrays on each update.
function sameIdSet(a: string[] | undefined, b: Set<string>): boolean {
	if (!a) return false;
	if (a.length !== b.size) return false;
	for (const id of a) if (!b.has(id)) return false;
	return true;
}
watch(() => props.selection, (val) => {
	if (val !== undefined && !sameIdSet(val, selection.selectedIds.value)) {
		selection.setSelection(val);
	}
}, { immediate: true });
watch(selection.selectedIds, (set) => {
	const ids = [...set];
	if (sameIdSet(props.selection, set)) return;
	emit('update:selection', ids, selection.selectedItems.value);
});
const clipboard    = useClipboard(engine, navigation, configRef as Ref<VobConfig>, () => publicApi);
const inlineRename = useInlineRename(engine, configRef as Ref<VobConfig>, () => publicApi);
const vobModal     = useVobModal();

/**
 * effectiveModal merges config.modals overrides with the built-in VobModal
 * component. If a consumer provides their own confirm/prompt implementations
 * (e.g. using their own UI library), those take precedence.
 */
const effectiveModal = {
	...vobModal,
	confirm: (message: string): Promise<boolean> => {
		const override = configRef.value.modals?.confirm;
		return override ? override(message) : vobModal.confirm(message);
	},
	prompt: (message: string, defaultValue?: string): Promise<string | null> => {
		const override = configRef.value.modals?.prompt;
		return override ? override(message, defaultValue) : vobModal.prompt(message, defaultValue);
	},
};

// openItem — shared "open" action (double-click / Enter / context menu Open).
// getApi is a lazy getter to avoid a circular reference with publicApi declared below.
const openItem = useOpenItem(
	engine,
	navigation,
	selection,
	configRef as Ref<VobConfig>,
	() => publicApi,
);

const contextMenu  = useContextMenu(engine, navigation, selection, clipboard, configRef as Ref<VobConfig>, dataSpecRef as Ref<VobDataSpec>, effectiveModal, openItem.openItem, () => publicApi);

// dragDrop — PNP-based drag-and-drop (no-ops gracefully if vue-pick-n-plop is absent).
const instanceId = props.instanceId;
// NOTE: publicApi is declared below. The lazy getter `() => publicApi` is safe
// because it is only *called* during drop events (after setup completes).
const dragDrop = useDragDrop(
	engine,
	navigation,
	selection,
	configRef as Ref<VobConfig>,
	dataSpecRef as Ref<VobDataSpec>,
	instanceId,
	() => publicApi,
);

/**
 * PNPDragLayer teleports drag ghost elements to <body>.
 * When vue-pick-n-plop is not installed, the alias resolves to pnpStub.ts
 * which exports null for PNPDragLayer, so the v-if guard keeps it out of
 * the DOM entirely.
 */
const pnpDragLayer = PNPDragLayer;

// containerEl is used by useKeyboardShortcuts to scope shortcuts to this instance.
const containerEl = ref<HTMLElement | null>(null);

useKeyboardShortcuts(
	containerEl,
	engine,
	navigation,
	selection,
	sortFilter,
	clipboard,
	inlineRename,
	configRef as Ref<VobConfig>,
	dataSpecRef as Ref<VobDataSpec>,
	effectiveModal,
	openItem.openItem,
);

// ----------------------------------------------------------------
// Provide to all descendants
// ----------------------------------------------------------------

provide(VOB_ENGINE_KEY,        engine);
provide(VOB_NAVIGATION_KEY,    navigation);
provide(VOB_SELECTION_KEY,     selection);
provide(VOB_SORT_FILTER_KEY,   sortFilter);
provide(VOB_VIEW_MODE_KEY,     viewMode);
provide(VOB_CLIPBOARD_KEY,     clipboard);
provide(VOB_CONFIG_KEY,        configRef as Ref<VobConfig>);
provide(VOB_DATA_SPEC_KEY,     dataSpecRef as Ref<VobDataSpec>);
provide(VOB_INLINE_RENAME_KEY, inlineRename);
provide(VOB_MODAL_KEY,         effectiveModal);
provide(VOB_CONTEXT_MENU_KEY,  contextMenu);
provide(VOB_OPEN_ITEM_KEY,     openItem);
provide(VOB_DRAG_DROP_KEY,     dragDrop);
// VOB_THEME_KEY is provided after themeClass + overlayStyle are declared below.

// ----------------------------------------------------------------
// Emit events when the path or data changes
// ----------------------------------------------------------------

watch(navigation.currentPathIds, (pathIds) => {
	emit('navigate', pathIds, navigation.currentPathString.value);
	// Clear selection when the folder changes.
	selection.clearSelection();
});

// Emit onDataChanged only on internal user-driven mutations (create, delete,
// rename, move). Watching mutationVersion rather than registry means that
// re-ingesting the :data prop (e.g. when the parent feeds onDataChanged items
// back into :data) does NOT re-trigger the event, breaking the update loop.
watch(engine.mutationVersion, () => {
	emit('onDataChanged', [...engine.registry.value.values()]);

	// Granular emits
	const mutation = engine.lastMutation.value;
	if (!mutation) return;

	switch (mutation.type) {
		case 'create':
			emit('onCreate', mutation.payload);
			break;
		case 'delete':
			emit('onDelete', mutation.payload);
			break;
		case 'update':
			// For rename specifically, we check if the name changed.
			// Currently rename is the only 'update' in the core.
			emit('onRename', mutation.payload, mutation.payload.name, ''); // Old name not easily available here, but payload is fresh
			break;
		case 'move':
			emit('onMove', mutation.payload.items, mutation.payload.targetFolderId);
			break;
	}
}, { immediate: false });

// ----------------------------------------------------------------
// Loading overlay
// ----------------------------------------------------------------

const isLoading = ref(false);

// ----------------------------------------------------------------
// Column view → switch to last column path when leaving
// ----------------------------------------------------------------

watch(viewMode.viewMode, (newMode, oldMode) => {
	if (oldMode === VOB.VIEW_MODES.COLUMNS && newMode !== VOB.VIEW_MODES.COLUMNS) {
		// currentPathIds already equals the rightmost column (maintained by navigation).
		// No extra work needed — history already has the correct snapshot.
	}
});

// ----------------------------------------------------------------
// Theme → CSS custom properties
// ----------------------------------------------------------------

const THEME_VAR_MAP: Array<[keyof VobTheme, string]> = [
	['backgroundColor',                '--vob-bg'],
	['backgroundColorAlt',             '--vob-bg-alt'],
	['surfaceColor',                   '--vob-surface'],
	['surfaceColorRaised',             '--vob-surface-raised'],
	['borderColor',                    '--vob-border'],
	['textColor',                      '--vob-text'],
	['textColorMuted',                 '--vob-text-muted'],
	['textColorOnAccent',              '--vob-text-on-accent'],
	['accentColor',                    '--vob-accent'],
	['accentColorHover',               '--vob-accent-hover'],
	['selectionColor',                 '--vob-selection-bg'],
	['selectionBorderColor',           '--vob-selection-border'],
	['buttonHoverBackgroundColor',     '--vob-btn-hover-bg'],
	['buttonActiveBackgroundColor',    '--vob-btn-active-bg'],
	['scrollbarTrackColor',            '--vob-scrollbar-track'],
	['scrollbarThumbColor',            '--vob-scrollbar-thumb'],
	['rowColorEven',                   '--vob-row-even'],
	['rowColorOdd',                    '--vob-row-odd'],
	['rowColorHover',                  '--vob-row-hover'],
	['rowColorSelected',               '--vob-row-selected'],
	['fontFamily',                     '--vob-font-family'],
	['fontSize',                       '--vob-font-size'],
	['iconSize',                       '--vob-icon-size'],
	['rowHeight',                      '--vob-row-height'],
	['barHeight',                      '--vob-bar-height'],
	['borderRadius',                   '--vob-border-radius'],
	['indentWidth',                    '--vob-indent-width'],
	['iconColumnWidth',                '--vob-icon-col-width'],
	['iconColumnHeight',               '--vob-icon-col-height'],
	['columnMinWidth',                 '--vob-col-min-width'],
];

const themeClass = computed(() => {
	if (props.theme === 'light') return 'vob-theme-light';
	if (props.theme === 'dark')  return 'vob-theme-dark';
	// Custom theme object — cascade the dark preset's CSS as the
	// baseline (or the explicitly-requested `baseTheme`) so any
	// vars the user didn't override still resolve to sensible
	// values in BOTH the in-flow component AND its Teleport
	// overlays. Inline `themeVars` (style="..." on the same
	// element) takes precedence over the cascaded class, so the
	// user's custom values still win where set.
	const base = (props.theme as VobTheme | undefined)?.baseTheme;
	return base === 'light' ? 'vob-theme-light' : 'vob-theme-dark';
});

const themeVars = computed<Record<string, string>>(() => {
	const vars: Record<string, string> = {};
	if (!props.theme || typeof props.theme === 'string') return vars;

	const t = props.theme;
	for (const [key, cssVar] of THEME_VAR_MAP) {
		const val = t[key] as string | undefined;
		if (val) vars[cssVar] = val;
	}
	// Legacy rowColors support
	if (t.rowColors) {
		vars['--vob-row-even'] = t.rowColors[0];
		vars['--vob-row-odd']  = t.rowColors[1];
	}
	if (t.cssVars) Object.assign(vars, t.cssVars);
	return vars;
});

/**
 * Provides all necessary CSS variables to Teleport-based overlays (VobModal,
 * VobContextMenu) that render outside .vob-container and therefore can't
 * inherit our scoped custom properties via the DOM.
 *
 * We seed dimension tokens with safe defaults so the overlay always has
 * something to work with, then overlay user-supplied vars on top.
 */
const overlayStyle = computed<Record<string, string>>(() => ({
	'--vob-font-family':    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
	'--vob-font-size':      '13px',
	'--vob-icon-size':      '18px',
	'--vob-border-radius':  '4px',
	...themeVars.value,
}));

// Provided here (after themeClass + overlayStyle are defined) so descendants
// that teleport outside .vob-container can apply the correct theme.
provide(VOB_THEME_KEY, { themeClass, overlayStyle });

// ----------------------------------------------------------------
// Row rendering helpers
// ----------------------------------------------------------------

const DEFAULT_ROWS = [
	{ type: VOB.ROWS.NAV_BAR,      buttons: [VOB.BUTTONS.BACK, VOB.BUTTONS.FORWARD, VOB.BUTTONS.UP, VOB.SEPARATOR, VOB.BUTTONS.REFRESH] },
	{ type: VOB.ROWS.BUTTONS_BAR,  buttons: [VOB.BUTTONS.NEW_FOLDER, VOB.SEPARATOR, VOB.BUTTONS.CUT, VOB.BUTTONS.COPY, VOB.BUTTONS.PASTE, VOB.SEPARATOR, VOB.BUTTONS.RENAME, VOB.BUTTONS.DELETE], viewModeSettings: { availableViewModes: Object.values(VOB.VIEW_MODES), defaultViewMode: VOB.VIEW_MODES.DETAILS } },
	{ type: VOB.ROWS.CONTENT },
	{ type: VOB.ROWS.STATUS_BAR },
];

const activeRows = computed(() => configRef.value.rows ?? DEFAULT_ROWS);

// ----------------------------------------------------------------
// Public API (exposed via template ref)
// ----------------------------------------------------------------

function apiNavigateTo(pathOrId: string): void {
	if (pathOrId.startsWith('/')) {
		navigation.navigateToPath(pathOrId);
	} else {
		// Treat as a single ID — navigate to the path that ends at this ID.
		const item = engine.getItem(pathOrId);
		if (!item) {
			console.warn(`[VueOmniBrowser] navigateTo: item with id "${pathOrId}" not found.`);
			return;
		}
		// Build the full path from root to this item.
		const pathIds: string[] = [];
		let current: VobItem | undefined = item;
		while (current) {
			pathIds.unshift(current.id);
			current = current.parentId ? engine.getItem(current.parentId) : undefined;
		}
		navigation.navigateTo(pathIds);
	}
}

const publicApi: VobApi = {
	navigateTo:  apiNavigateTo,
	getSelection:() => selection.selectedItems.value,
	setSelection:(ids) => selection.setSelection(ids),
	refresh:     () => engine.refresh(),
	setLoading:  (loading) => { isLoading.value = loading; },
	createItem:  (data, parentId?) => {
		// If the caller passed parentId as the second arg, use that.
		// Otherwise fall back to data.parentId (common in onExternalDrop callbacks
		// where the full item shape is spread as a single object).
		const resolvedParentId = parentId !== undefined
			? parentId
			: ((data as { parentId?: string | null }).parentId ?? null);
		return engine.createItem({ ...(data as Omit<VobItem, 'id'>), parentId: resolvedParentId });
	},
	deleteItems: (ids) => {
		const removed = engine.deleteItems(ids);
		selection.setSelection([...selection.selectedIds.value].filter((id) => !removed.includes(id)));
		return removed;
	},
};

defineExpose(publicApi);

// The template has multiple root nodes (container + teleported overlays + PNPDragLayer),
// so Vue cannot auto-inherit attrs like class/style. We disable auto-inherit and
// forward $attrs onto the real root element manually.
defineOptions({ inheritAttrs: false });
</script>

<template>
	<div
		ref="containerEl"
		v-bind="$attrs"
		class="vob-container"
		:class="[themeClass]"
		:style="themeVars"
		data-vob
	>
		<!-- Dynamic row layout from config.rows -->
		<template v-for="(row, i) in activeRows" :key="i">
			<NavBar
				v-if="row.type === 'nav-bar'"
				:row="(row as any)"
			/>
			<ButtonsBar
				v-else-if="row.type === 'buttons-bar'"
				:row="(row as any)"
			/>
			<ContentArea
				v-else-if="row.type === 'content'"
			/>
			<StatusBar
				v-else-if="row.type === 'status-bar'"
				:row="(row as any)"
			/>
			<CustomBar
				v-else-if="row.type === 'custom-bar'"
				:row="(row as any)"
			/>
		</template>

		<!-- Global loading overlay -->
		<Transition name="vob-fade">
			<div v-if="isLoading" class="vob-loading-overlay" aria-busy="true" aria-label="Loading">
				<div class="vob-spinner" />
			</div>
		</Transition>
	</div>

	<!-- Teleport-based overlays — rendered outside .vob-container but themed via inject -->
	<VobModal />
	<VobContextMenu />
	<!-- PNPDragLayer teleports all drag ghosts to <body>. -->
	<!-- Only rendered when vue-pick-n-plop is installed (peer dep). -->
	<component :is="pnpDragLayer" v-if="pnpDragLayer" :z-index="9500" />
</template>

<style scoped>
.vob-fade-enter-active,
.vob-fade-leave-active {
	transition: opacity 0.15s;
}

.vob-fade-enter-from,
.vob-fade-leave-to {
	opacity: 0;
}
</style>
