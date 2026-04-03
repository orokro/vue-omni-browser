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
import { VOB } from '../constants';
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
}>(), {
	config: () => ({}),
	dataSpec: () => ({ types: [] }),
	data: () => [],
	theme: 'dark',
});

const emit = defineEmits<{
	/** Emitted when the internal data changes (create, delete, rename, paste). */
	onDataChanged: [data: VobItem[]];
	/** Emitted when the active path changes. */
	navigate: [pathIds: string[], pathString: string];
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
const clipboard    = useClipboard(engine, navigation, configRef as Ref<VobConfig>);
const inlineRename = useInlineRename(engine, configRef as Ref<VobConfig>);
const vobModal     = useVobModal();
const contextMenu  = useContextMenu(engine, navigation, selection, clipboard, configRef as Ref<VobConfig>, dataSpecRef as Ref<VobDataSpec>);

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
provide(VOB_MODAL_KEY,         vobModal);
provide(VOB_CONTEXT_MENU_KEY,  contextMenu);
// VOB_THEME_KEY is provided after themeClass + overlayStyle are declared below.

// ----------------------------------------------------------------
// Emit navigate when the path changes
// ----------------------------------------------------------------

watch(navigation.currentPathIds, (pathIds) => {
	emit('navigate', pathIds, navigation.currentPathString.value);
	// Clear selection when the folder changes.
	selection.clearSelection();
});

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
	['backgroundColor',  '--vob-bg'],
	['accentColor',      '--vob-accent'],
	['selectionColor',   '--vob-selection-bg'],
	['textColor',        '--vob-text'],
	['mutedTextColor',   '--vob-text-muted'],
	['borderColor',      '--vob-border'],
	['fontFamily',       '--vob-font-family'],
	['fontSize',         '--vob-font-size'],
	['iconSize',         '--vob-icon-size'],
	['rowHeight',        '--vob-row-height'],
];

const themeClass = computed(() => {
	if (props.theme === 'light') return 'vob-theme-light';
	if (props.theme === 'dark')  return 'vob-theme-dark';
	// Object theme — default to dark, user overrides via cssVars
	return 'vob-theme-dark';
});

const themeVars = computed<Record<string, string>>(() => {
	const vars: Record<string, string> = {};
	if (!props.theme || typeof props.theme === 'string') return vars;

	const t = props.theme;
	for (const [key, cssVar] of THEME_VAR_MAP) {
		const val = t[key] as string | undefined;
		if (val) vars[cssVar] = val;
	}
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
	createItem:  (data, parentId = null) => {
		const id = engine.createItem({ ...(data as Omit<VobItem, 'id'>), parentId });
		emit('onDataChanged', [...engine.registry.value.values()]);
		return id;
	},
	deleteItems: (ids) => {
		const removed = engine.deleteItems(ids);
		selection.setSelection([...selection.selectedIds.value].filter((id) => !removed.includes(id)));
		emit('onDataChanged', [...engine.registry.value.values()]);
		return removed;
	},
};

defineExpose(publicApi);
</script>

<template>
	<div
		ref="containerEl"
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
