/**
 * @file core/useNavigation.ts
 * @description History stack and navigation state for VueOmniBrowser.
 *
 * Navigation is path-ID based internally: the "current location" is always
 * represented as an ordered array of item IDs from root → current folder.
 * The human-readable path string is derived from this on demand.
 *
 * History is a simple array of snapshots. Back/Forward moves a pointer through it;
 * navigating to a new location truncates any "forward" history (as browsers do).
 *
 * Column view writes column-stack snapshots to history so that switching to
 * another view mode and back restores the full column state. The active path
 * in column view is always the rightmost column's selection.
 *
 * Injection key: VOB_NAVIGATION_KEY
 */

import { ref, computed, watch, type Ref } from 'vue';
import type { VobEngine } from './useVobEngine';
import type { VobConfig } from '../types';
import { pathIdsToString, pathStringToIds } from '../utils/pathUtils';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

/**
 * A single entry in the history stack.
 * For column view, `columnStack` stores all column paths simultaneously.
 */
export interface NavigationSnapshot {
	/** The active path (root → current folder) as ID array. */
	pathIds: string[];
	/**
	 * For column view only: the full ordered stack of paths, one per visible column.
	 * `pathIds` equals the last entry in this array when in column view.
	 */
	columnStack?: string[][];
}

export interface VobNavigation {
	/** The current path as an ordered array of item IDs. Root = []. */
	currentPathIds: Readonly<Ref<string[]>>;
	/** The ID of the deepest folder in the current path (i.e. what's open). Null = root. */
	currentFolderId: Readonly<Ref<string | null>>;
	/**
	 * A human-readable `/`-delimited string derived from currentPathIds.
	 * Only unambiguous when allowDuplicateNames is false.
	 */
	currentPathString: Readonly<Ref<string>>;
	/** True when there is a previous history entry to go back to. */
	canGoBack: Readonly<Ref<boolean>>;
	/** True when there is a next history entry to go forward to. */
	canGoForward: Readonly<Ref<boolean>>;
	/** True when the current path has at least one segment (not at root). */
	canGoUp: Readonly<Ref<boolean>>;

	// Column view state
	/** The full column stack (column view only). Empty when not in column view. */
	columnStack: Readonly<Ref<string[][]>>;

	/**
	 * Navigate to the given path, pushing a new history entry.
	 * @param pathIds - Ordered array of item IDs representing the destination.
	 * @param columnStack - If supplied, also updates the column view stack.
	 */
	navigateTo: (pathIds: string[], columnStack?: string[][]) => void;
	/**
	 * Navigate to a location by its human-readable path string (e.g. '/Assets/Textures').
	 * Logs a warning and no-ops when allowDuplicateNames is enabled.
	 * @returns True if navigation succeeded, false if the path could not be resolved.
	 */
	navigateToPath: (pathString: string) => boolean;
	/** Move one step back in history. No-ops if already at the earliest entry. */
	back: () => void;
	/** Move one step forward in history. No-ops if at the latest entry. */
	forward: () => void;
	/** Navigate to the parent of the current location. No-ops at root. */
	up: () => void;
	/** Navigate to the root (empty path). */
	goToRoot: () => void;
	/**
	 * Called by the engine whenever the registry is rebuilt.
	 * Repairs the current path to the nearest valid ancestor.
	 */
	onRegistryChanged: () => void;
}

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Creates and returns the navigation state for a VueOmniBrowser instance.
 *
 * @param engine - The VobEngine instance (provides registry and repairPath).
 * @param config - The reactive config ref.
 */
export function useNavigation(engine: VobEngine, config: Ref<VobConfig>): VobNavigation {
	// The ordered history stack of location snapshots.
	const history = ref<NavigationSnapshot[]>([{ pathIds: [] }]);

	// Pointer into `history.value`. Points at the "current" entry.
	const historyIndex = ref(0);

	// ----------------------------------------------------------------
	// Derived current state
	// ----------------------------------------------------------------

	const currentSnapshot = computed<NavigationSnapshot>(
		() => history.value[historyIndex.value] ?? { pathIds: [] },
	);

	const currentPathIds = computed<string[]>(() => currentSnapshot.value.pathIds);

	const currentFolderId = computed<string | null>(
		() => currentPathIds.value[currentPathIds.value.length - 1] ?? null,
	);

	const currentPathString = computed<string>(() =>
		pathIdsToString(currentPathIds.value, engine.registry.value),
	);

	const columnStack = computed<string[][]>(() => currentSnapshot.value.columnStack ?? []);

	const canGoBack = computed(() => historyIndex.value > 0);
	const canGoForward = computed(() => historyIndex.value < history.value.length - 1);
	const canGoUp = computed(() => currentPathIds.value.length > 0);

	// ----------------------------------------------------------------
	// Navigation actions
	// ----------------------------------------------------------------

	/**
	 * Pushes a new snapshot to the history stack at the current pointer,
	 * discarding any "forward" entries that existed beyond it.
	 */
	function pushSnapshot(snapshot: NavigationSnapshot): void {
		// Discard forward history.
		history.value = history.value.slice(0, historyIndex.value + 1);
		history.value.push(snapshot);
		historyIndex.value = history.value.length - 1;
	}

	/**
	 * Navigate to a new location by ID path, optionally with a column stack.
	 */
	function navigateTo(pathIds: string[], incomingColumnStack?: string[][]): void {
		pushSnapshot({
			pathIds,
			columnStack: incomingColumnStack,
		});
	}

	/**
	 * Navigate by human-readable path string.
	 * No-ops with a warning if allowDuplicateNames is enabled.
	 */
	function navigateToPath(pathString: string): boolean {
		if (config.value.allowDuplicateNames) {
			console.warn(
				`[VueOmniBrowser] navigateToPath("${pathString}") is a no-op when allowDuplicateNames is enabled. ` +
				`Use navigateTo(idArray) instead.`,
			);
			return false;
		}

		const resolved = pathStringToIds(pathString, engine.registry.value);
		if (!resolved) {
			console.warn(
				`[VueOmniBrowser] navigateToPath: could not resolve path "${pathString}" to a valid ID sequence.`,
			);
			return false;
		}

		navigateTo(resolved);
		return true;
	}

	/** Move backward in history. */
	function back(): void {
		if (!canGoBack.value) return;
		historyIndex.value--;
	}

	/** Move forward in history. */
	function forward(): void {
		if (!canGoForward.value) return;
		historyIndex.value++;
	}

	/** Navigate to the parent of the current folder. */
	function up(): void {
		if (!canGoUp.value) return;
		const parentPath = currentPathIds.value.slice(0, -1);
		navigateTo(parentPath);
	}

	/** Navigate to the root. */
	function goToRoot(): void {
		navigateTo([]);
	}

	// ----------------------------------------------------------------
	// Registry change handling — path repair
	// ----------------------------------------------------------------

	/**
	 * Called by the engine's registryVersion watcher.
	 * Silently repairs the current path to the nearest valid ancestor.
	 * If the path is already valid, does nothing (no spurious history entry).
	 */
	function onRegistryChanged(): void {
		const repaired = engine.repairPath(currentPathIds.value);

		// Only push if the path actually changed — avoids polluting history.
		if (repaired.length !== currentPathIds.value.length) {
			// Replace the current history entry in-place (not a navigable event).
			history.value[historyIndex.value] = {
				pathIds: repaired,
				// Prune column stack to match the repaired depth.
				columnStack: currentSnapshot.value.columnStack?.slice(0, repaired.length),
			};
		}
	}

	// Watch registryVersion so we repair the path whenever the dataset is rebuilt.
	watch(engine.registryVersion, () => {
		onRegistryChanged();
	});

	// ----------------------------------------------------------------
	// Return
	// ----------------------------------------------------------------

	return {
		currentPathIds,
		currentFolderId,
		currentPathString,
		canGoBack,
		canGoForward,
		canGoUp,
		columnStack,
		navigateTo,
		navigateToPath,
		back,
		forward,
		up,
		goToRoot,
		onRegistryChanged,
	};
}
