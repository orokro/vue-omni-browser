/**
 * @file core/useSelection.ts
 * @description Multi-select logic for VueOmniBrowser.
 *
 * Supports three click modes:
 *  - Normal click   → Select only the clicked item (clears previous selection).
 *  - Ctrl/Cmd click → Toggle the clicked item's membership in the selection.
 *  - Shift click    → Range-select from the last clicked item to the clicked item,
 *                     using the order of `orderedIds` at the time of the click.
 *
 * When multiSelect is disabled in config, Ctrl/Shift modifiers are ignored
 * and only single-item selection is allowed.
 *
 * The selection is cleared automatically when:
 *  - The current folder changes (navigation).
 *  - The view mode changes.
 *
 * Injection key: VOB_SELECTION_KEY
 */

import { ref, computed, type Ref } from 'vue';
import type { VobItem, VobConfig } from '../types';
import type { VobEngine } from './useVobEngine';
import { type InjectionKey } from 'vue';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type SelectModifier = 'none' | 'ctrl' | 'shift';

export interface VobSelection {
	/** The currently selected item IDs. Reactive Set. */
	selectedIds: Readonly<Ref<Set<string>>>;
	/** Ordered array of selected VobItems, derived from the registry. */
	selectedItems: Readonly<Ref<VobItem[]>>;
	/** The ID of the most recently directly-clicked item (anchor for Shift-range). */
	anchorId: Readonly<Ref<string | null>>;

	/**
	 * Process a click event on an item.
	 *
	 * @param id - The clicked item's ID.
	 * @param modifier - Which modifier key (if any) was held.
	 * @param orderedIds - The current display-order of all visible item IDs.
	 *   Required for shift-range calculation.
	 */
	handleClick: (id: string, modifier: SelectModifier, orderedIds: string[]) => void;

	/** Returns true if the given ID is currently selected. */
	isSelected: (id: string) => boolean;

	/** Select all of the given IDs, replacing the existing selection. */
	selectAll: (ids: string[]) => void;

	/** Clear the entire selection. */
	clearSelection: () => void;

	/**
	 * Programmatically set the selection to the given IDs.
	 * Respects multiSelect — if disabled and ids.length > 1, only the first is selected.
	 */
	setSelection: (ids: string[]) => void;
}

export const VOB_SELECTION_KEY: InjectionKey<VobSelection> = Symbol('vob-selection');

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Creates and returns the selection state for a VueOmniBrowser instance.
 *
 * @param engine - The VobEngine instance (used to resolve VobItems from IDs).
 * @param config - The reactive config ref.
 */
export function useSelection(engine: VobEngine, config: Ref<VobConfig>): VobSelection {
	// Internal mutable Set. We replace the ref value when mutating to ensure
	// Vue's reactivity system picks up Set changes (Sets are not deeply reactive by default).
	const selectedIds = ref<Set<string>>(new Set());

	// The anchor ID used for Shift-range selection.
	const anchorId = ref<string | null>(null);

	// ----------------------------------------------------------------
	// Derived
	// ----------------------------------------------------------------

	const selectedItems = computed<VobItem[]>(() => {
		const result: VobItem[] = [];
		for (const id of selectedIds.value) {
			const item = engine.getItem(id);
			if (item) result.push(item);
		}
		return result;
	});

	// ----------------------------------------------------------------
	// Helpers
	// ----------------------------------------------------------------

	/** Returns true if multiSelect is enabled (default: true). */
	const isMultiSelect = (): boolean => config.value.multiSelect !== false;

	/** Replaces the selectedIds ref with a new Set (ensures reactivity). */
	function setIds(ids: Iterable<string>): void {
		selectedIds.value = new Set(ids);
	}

	/** Computes the inclusive ID range between `fromId` and `toId` in `orderedIds`. */
	function rangeIds(fromId: string, toId: string, orderedIds: string[]): string[] {
		const fromIndex = orderedIds.indexOf(fromId);
		const toIndex = orderedIds.indexOf(toId);

		if (fromIndex === -1 || toIndex === -1) return [toId];

		const start = Math.min(fromIndex, toIndex);
		const end = Math.max(fromIndex, toIndex);
		return orderedIds.slice(start, end + 1);
	}

	// ----------------------------------------------------------------
	// Click handler
	// ----------------------------------------------------------------

	/**
	 * Central selection handler. Intended to be called from item click events
	 * in all view modes (list, details, icons, tree, columns).
	 */
	function handleClick(id: string, modifier: SelectModifier, orderedIds: string[]): void {
		if (!isMultiSelect() || modifier === 'none') {
			// Simple single selection: clear and select only this item.
			setIds([id]);
			anchorId.value = id;
			return;
		}

		if (modifier === 'ctrl') {
			// Toggle membership.
			const next = new Set(selectedIds.value);
			if (next.has(id)) {
				next.delete(id);
				// If we deselected the anchor, the anchor stays (Shift-range anchors from
				// the last *activated* item, not the last *selected* one).
			} else {
				next.add(id);
				anchorId.value = id;
			}
			setIds(next);
			return;
		}

		if (modifier === 'shift') {
			// Range select from anchor → clicked item.
			const anchor = anchorId.value ?? id;
			const range = rangeIds(anchor, id, orderedIds);

			if (selectedIds.value.size === 0) {
				// No existing selection — just select the range.
				setIds(range);
			} else {
				// Merge the range into the existing selection (keeps non-range items).
				const merged = new Set(selectedIds.value);
				for (const rangeId of range) merged.add(rangeId);
				setIds(merged);
			}
			// Shift-click does NOT update the anchor — the anchor is always the Ctrl/normal click.
			return;
		}
	}

	// ----------------------------------------------------------------
	// Utility actions
	// ----------------------------------------------------------------

	function isSelected(id: string): boolean {
		return selectedIds.value.has(id);
	}

	function selectAll(ids: string[]): void {
		if (!isMultiSelect()) {
			// Honour the config: only select the first item.
			setIds(ids.slice(0, 1));
			anchorId.value = ids[0] ?? null;
			return;
		}
		setIds(ids);
		anchorId.value = ids[ids.length - 1] ?? null;
	}

	function clearSelection(): void {
		setIds([]);
		anchorId.value = null;
	}

	function setSelection(ids: string[]): void {
		const toSet = isMultiSelect() ? ids : ids.slice(0, 1);
		setIds(toSet);
		anchorId.value = toSet[toSet.length - 1] ?? null;
	}

	// ----------------------------------------------------------------
	// Return
	// ----------------------------------------------------------------

	return {
		selectedIds,
		selectedItems,
		anchorId,
		handleClick,
		isSelected,
		selectAll,
		clearSelection,
		setSelection,
	};
}
