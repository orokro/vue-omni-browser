/**
 * @file core/useViewMode.ts
 * @description View mode and zoom state for VueOmniBrowser.
 *
 * View mode is initialised from the ButtonsBar row's viewModeSettings.defaultViewMode
 * (or falls back to 'details'). Zoom is similarly initialised from zoomSettings.defaultZoom.
 *
 * When the user is in column view, nav buttons (Back/Forward/Up) are disabled
 * because the view itself IS the navigation. Switching away from column view
 * preserves position via the history stack's columnStack snapshots.
 *
 * Injection key: VOB_VIEW_MODE_KEY
 */

import { ref, computed, type Ref } from 'vue';
import type { VobConfig, VobButtonsBarRow } from '../types';
import { VOB, type VobViewMode } from '../constants';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface VobViewModeState {
	/** The currently active view mode. */
	viewMode: Ref<VobViewMode>;
	/** Current zoom level (1.0 = 100%). Only meaningful in icons view. */
	zoom: Ref<number>;
	/** Minimum allowed zoom (from config). */
	minZoom: Readonly<Ref<number>>;
	/** Maximum allowed zoom (from config). */
	maxZoom: Readonly<Ref<number>>;
	/** View modes available for the user to switch between. */
	availableViewModes: Readonly<Ref<VobViewMode[]>>;
	/** True when the active view mode is column view. */
	isColumnView: Readonly<Ref<boolean>>;

	/** Switch to the given view mode. No-ops if not in availableViewModes. */
	setViewMode: (mode: VobViewMode) => void;
	/** Set zoom, clamped to [minZoom, maxZoom]. */
	setZoom: (zoom: number) => void;
	/** Step zoom in by a fixed increment. */
	zoomIn: () => void;
	/** Step zoom out by a fixed increment. */
	zoomOut: () => void;
}

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const ZOOM_STEP = 0.25;
const DEFAULT_ZOOM = 1;
const DEFAULT_MIN_ZOOM = 0.5;
const DEFAULT_MAX_ZOOM = 3;
const ALL_VIEW_MODES = Object.values(VOB.VIEW_MODES) as VobViewMode[];

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Creates and returns the view mode state for a VueOmniBrowser instance.
 *
 * @param config - The reactive config ref.
 */
export function useViewMode(config: Ref<VobConfig>): VobViewModeState {
	// Find the ButtonsBar row definition from config to read its settings.
	const buttonsBarRow = computed<VobButtonsBarRow | undefined>(
		() => config.value.rows?.find((r) => r.type === VOB.ROWS.BUTTONS_BAR) as VobButtonsBarRow | undefined,
	);

	// Derive limits from config (reactive — if config changes, limits update).
	const minZoom = computed(() => buttonsBarRow.value?.zoomSettings?.minZoom ?? DEFAULT_MIN_ZOOM);
	const maxZoom = computed(() => buttonsBarRow.value?.zoomSettings?.maxZoom ?? DEFAULT_MAX_ZOOM);

	const availableViewModes = computed<VobViewMode[]>(
		() => (buttonsBarRow.value?.viewModeSettings?.availableViewModes as VobViewMode[]) ?? ALL_VIEW_MODES,
	);

	// Initialise from config defaults.
	const initialViewMode = (
		buttonsBarRow.value?.viewModeSettings?.defaultViewMode as VobViewMode | undefined
	) ?? VOB.VIEW_MODES.DETAILS;

	const initialZoom = buttonsBarRow.value?.zoomSettings?.defaultZoom ?? DEFAULT_ZOOM;

	const viewMode = ref<VobViewMode>(initialViewMode);
	const zoom = ref<number>(initialZoom);

	// ----------------------------------------------------------------
	// Derived
	// ----------------------------------------------------------------

	const isColumnView = computed(() => viewMode.value === VOB.VIEW_MODES.COLUMNS);

	// ----------------------------------------------------------------
	// Actions
	// ----------------------------------------------------------------

	function setViewMode(mode: VobViewMode): void {
		if (!availableViewModes.value.includes(mode)) return;
		viewMode.value = mode;
	}

	function setZoom(value: number): void {
		zoom.value = Math.min(maxZoom.value, Math.max(minZoom.value, value));
	}

	function zoomIn(): void {
		setZoom(zoom.value + ZOOM_STEP);
	}

	function zoomOut(): void {
		setZoom(zoom.value - ZOOM_STEP);
	}

	// ----------------------------------------------------------------
	// Return
	// ----------------------------------------------------------------

	return {
		viewMode,
		zoom,
		minZoom,
		maxZoom,
		availableViewModes,
		isColumnView,
		setViewMode,
		setZoom,
		zoomIn,
		zoomOut,
	};
}
