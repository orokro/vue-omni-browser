/**
 * @file core/useSortFilter.ts
 * @description Sorting and filtering logic for the content area.
 *
 * Provides a reactive `applyToItems()` function that takes a raw list of VobItems
 * and returns a sorted and filtered copy ready for the active view to render.
 *
 * Three layers are applied in order:
 *  1. Type filter  — show only items whose type matches the selected filter slug.
 *  2. Search query — simple case-insensitive name match (full-text search is
 *                    handled externally via config.searchLoader).
 *  3. Sort         — sort by the active metaKey, ascending or descending.
 *     Folders (items with hasChildren === true in their type definition) are always
 *     sorted before files, matching OS-native behaviour.
 *
 * Injection key: VOB_SORT_FILTER_KEY
 */

import { ref, computed, type Ref } from 'vue';
import type { VobItem, VobDataSpec } from '../types';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type SortDirection = 'asc' | 'desc';

export interface VobSortFilter {
	/** The metadata key currently used for sorting. Null means "default" (name, asc). */
	sortKey: Ref<string | null>;
	/** Sort direction. Default: 'asc'. */
	sortDirection: Ref<SortDirection>;
	/**
	 * Active type-filter slug. Only items whose `type` matches this are shown.
	 * Null means "all types visible".
	 */
	activeTypeFilter: Ref<string | null>;
	/**
	 * Live search query. Items whose `name` does not contain this string
	 * (case-insensitive) are hidden.
	 */
	searchQuery: Ref<string>;

	/**
	 * When true, search expands to every item in the dataset rather
	 * than just the children of the current folder. Wired end-to-end
	 * on the public API surface; full view-level recursive read lands
	 * in a follow-up so hosts can already drive the toggle from their
	 * own UI without API churn later.
	 */
	recursiveSearch: Ref<boolean>;

	/**
	 * Set the sort key. If the same key is provided twice, the direction toggles.
	 * Passing null resets to default (name, asc).
	 */
	setSortKey: (key: string | null) => void;

	/** Explicitly set the sort direction without changing the key. */
	setSortDirection: (direction: SortDirection) => void;

	/** Set the active type filter. Pass null to show all types. */
	setTypeFilter: (typeSlug: string | null) => void;

	/** Update the search query. */
	setSearchQuery: (query: string) => void;

	/** Toggle the recursive-search flag. */
	setRecursiveSearch: (value: boolean) => void;

	/**
	 * Apply the active sort/filter state to the given item array.
	 * Returns a new sorted, filtered array — does not mutate the input.
	 *
	 * @param items - The unordered items for the current directory.
	 * @param dataSpec - The current dataSpec (used to detect folder types for grouping).
	 */
	applyToItems: (items: VobItem[], dataSpec: VobDataSpec) => VobItem[];

	/** True when any filter (type or search) is currently active. */
	hasActiveFilter: Readonly<Ref<boolean>>;
}

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Creates and returns the sort/filter state for a VueOmniBrowser instance.
 */
export function useSortFilter(): VobSortFilter {
	const sortKey = ref<string | null>(null);
	const sortDirection = ref<SortDirection>('asc');
	const activeTypeFilter = ref<string | null>(null);
	const searchQuery = ref<string>('');
	const recursiveSearch = ref<boolean>(false);

	// ----------------------------------------------------------------
	// Setters
	// ----------------------------------------------------------------

	/**
	 * Sets the sort key. If called with the same key that is already active,
	 * the direction toggles (asc → desc → asc ...).
	 */
	function setSortKey(key: string | null): void {
		if (key === null) {
			sortKey.value = null;
			sortDirection.value = 'asc';
			return;
		}

		if (sortKey.value === key) {
			sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey.value = key;
			sortDirection.value = 'asc';
		}
	}

	function setSortDirection(direction: SortDirection): void {
		sortDirection.value = direction;
	}

	function setTypeFilter(typeSlug: string | null): void {
		activeTypeFilter.value = typeSlug;
	}

	function setSearchQuery(query: string): void {
		searchQuery.value = query;
	}

	function setRecursiveSearch(value: boolean): void {
		recursiveSearch.value = value;
	}

	// ----------------------------------------------------------------
	// Derived
	// ----------------------------------------------------------------

	const hasActiveFilter = computed(
		() => activeTypeFilter.value !== null || searchQuery.value.trim().length > 0,
	);

	// ----------------------------------------------------------------
	// Core pipeline
	// ----------------------------------------------------------------

	/**
	 * Compares two VobItem values for a given key. Returns a negative, zero, or
	 * positive number suitable for Array.prototype.sort.
	 */
	function compareValues(a: unknown, b: unknown): number {
		// Null / undefined → sort last.
		if (a === null || a === undefined) return 1;
		if (b === null || b === undefined) return -1;

		if (typeof a === 'number' && typeof b === 'number') {
			return a - b;
		}

		// Fall back to locale-aware string comparison.
		return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
	}

	/**
	 * Apply sort, type-filter and search-query to the supplied item array.
	 */
	function applyToItems(items: VobItem[], dataSpec: VobDataSpec): VobItem[] {
		// Build a Set of "folder" type slugs for the grouping step.
		const folderTypes = new Set<string>(
			dataSpec.types.filter((t) => t.hasChildren).map((t) => t.slug),
		);

		// 1. Type filter
		let result = items;
		if (activeTypeFilter.value !== null) {
			result = result.filter((item) => item.type === activeTypeFilter.value);
		}

		// 2. Search query (name contains, case-insensitive)
		const query = searchQuery.value.trim().toLowerCase();
		if (query.length > 0) {
			result = result.filter((item) => item.name.toLowerCase().includes(query));
		}

		// 3. Sort
		const key = sortKey.value ?? 'name';
		const dir = sortDirection.value === 'asc' ? 1 : -1;

		result = [...result].sort((a, b) => {
			// Folders always before files (stable regardless of sort key).
			const aIsFolder = folderTypes.has(a.type);
			const bIsFolder = folderTypes.has(b.type);
			if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;

			// Primary sort by active key.
			const aVal = a[key];
			const bVal = b[key];
			const cmp = compareValues(aVal, bVal);
			if (cmp !== 0) return cmp * dir;

			// Tie-break by name ascending for stability.
			return compareValues(a.name, b.name);
		});

		return result;
	}

	// ----------------------------------------------------------------
	// Return
	// ----------------------------------------------------------------

	return {
		sortKey,
		sortDirection,
		activeTypeFilter,
		searchQuery,
		recursiveSearch,
		setSortKey,
		setSortDirection,
		setTypeFilter,
		setSearchQuery,
		setRecursiveSearch,
		applyToItems,
		hasActiveFilter,
	};
}
