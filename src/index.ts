/**
 * @file index.ts
 * @description Public entry point for the vue-omni-browser library.
 *
 * Usage:
 *   import { VOB, VueOmniBrowser } from 'vue-omni-browser';
 *
 * The VOB namespace gives access to all built-in constants (row types, view modes,
 * actions, buttons, data modes, and the SEPARATOR sentinel).
 *
 * VueOmniBrowser is the root component — mount it anywhere in your Vue 3 app.
 *
 * NOTE: VueOmniBrowser.vue is a stub at this stage (Phase 1).
 * Component implementation begins in Phase 2.
 */

// ----------------------------------------------------------------
// Constants (primary consumer-facing namespace)
// ----------------------------------------------------------------
export { VOB } from './constants';
export type { VobRowType, VobViewMode, VobAction, VobButtonId, VobDataMode } from './constants';

// ----------------------------------------------------------------
// All public TypeScript interfaces
// ----------------------------------------------------------------
export type {
	// Icon
	VobIconSpec,
	// Item models
	VobItem,
	VobHierarchicalItemInput,
	VobFlatItemInput,
	VobItemInput,
	// DataSpec
	VobTypeDefinition,
	VobDataSpec,
	VobMetaKeyDefinition,
	VobTypeContextMenu,
	// Menus & Buttons
	VobSeparator,
	VobItemSpec,
	VobMenuEntry,
	VobContextMenuConfig,
	// Keyboard
	VobKeyboardShortcut,
	// Row definitions
	VobNavBarRow,
	VobButtonsBarRow,
	VobContentRow,
	VobStatusBarRow,
	VobCustomBarRow,
	VobRowDefinition,
	VobViewModeSettings,
	VobZoomSettings,
	VobFilterSettings,
	// Config
	VobConfig,
	VobModals,
	// Theme
	VobTheme,
	VobThemePreset,
	// Contexts
	VobActionContext,
	VobStatusContext,
	// Clipboard
	VobClipboard,
	// Public API
	VobApi,
} from './types';

// ----------------------------------------------------------------
// Main component (stub — full implementation in Phase 2)
// ----------------------------------------------------------------
// export { default as VueOmniBrowser } from './components/VueOmniBrowser.vue';

// ----------------------------------------------------------------
// Injection keys (useful for library consumers who build their own
// child components and want to inject the engine/navigation/etc.)
// ----------------------------------------------------------------
export { VOB_ENGINE_KEY } from './core/useVobEngine';
export { VOB_NAVIGATION_KEY } from './core/useNavigation';
export { VOB_SELECTION_KEY } from './core/useSelection';
export { VOB_SORT_FILTER_KEY } from './core/useSortFilter';
