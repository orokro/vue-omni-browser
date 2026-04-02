/**
 * @file index.ts
 * @description Public entry point for the vue-omni-browser library.
 *
 * Usage:
 *   import { VOB, VueOmniBrowser } from 'vue-omni-browser';
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
// Main component
// ----------------------------------------------------------------
export { default as VueOmniBrowser } from './components/VueOmniBrowser.vue';

// ----------------------------------------------------------------
// Injection keys — for consumers building custom child components
// All keys are now sourced from the single injectionKeys.ts module.
// ----------------------------------------------------------------
export {
	VOB_ENGINE_KEY,
	VOB_NAVIGATION_KEY,
	VOB_SELECTION_KEY,
	VOB_SORT_FILTER_KEY,
	VOB_VIEW_MODE_KEY,
	VOB_CLIPBOARD_KEY,
	VOB_CONFIG_KEY,
	VOB_DATA_SPEC_KEY,
} from './injectionKeys';
