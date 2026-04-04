/**
 * @file core/useVobEngine.ts
 * @description The core registry engine for VueOmniBrowser.
 *
 * Responsibilities:
 *  - Ingest :data (hierarchical or flat) into a reactive flat registry Map.
 *  - Watch :data for changes and automatically re-ingest.
 *  - Provide item/children lookup methods.
 *  - Expose a path-repair utility so useNavigation can snap to valid ancestors
 *    when data changes underneath the current view.
 *  - Emit a signal when the registry is rebuilt so dependents can re-validate.
 *
 * This composable is intended to be called once in VueOmniBrowser.vue and then
 * provided via provide/inject to all child components.
 */

import { shallowRef, computed, watch, type Ref } from 'vue';
import type {
	VobItem,
	VobConfig,
	VobDataSpec,
	VobHierarchicalItemInput,
	VobFlatItemInput,
	VobTypeDefinition,
} from '../types';
import { flattenHierarchy, ingestFlatItems, extractRootIds, getChildIds } from '../utils/treeUtils';
import { repairPath } from '../utils/pathUtils';
import { generateId } from '../utils/idUtils';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

/** The return type of useVobEngine, injected throughout the component tree. */
export interface VobEngine {
	/** The flat item registry. Changes trigger a new shallowRef value. */
	registry: Readonly<Ref<Map<string, VobItem>>>;
	/** IDs of all root-level items, in insertion order. */
	rootIds: Readonly<Ref<string[]>>;
	/**
	 * Looks up a single item by ID.
	 * @returns The VobItem, or undefined if not found.
	 */
	getItem: (id: string) => VobItem | undefined;
	/**
	 * Returns visible children of a given parent, respecting showHidden and itemFilter.
	 * Pass null to get root-level items.
	 */
	getChildren: (parentId: string | null) => VobItem[];
	/**
	 * Looks up the VobTypeDefinition for a given type slug.
	 * @returns The type definition, or undefined if the slug is not in the dataSpec.
	 */
	getTypeDefinition: (typeSlug: string) => VobTypeDefinition | undefined;
	/**
	 * Returns the longest valid prefix of the supplied path.
	 * Used by useNavigation to snap back to a valid ancestor on data change.
	 */
	repairPath: (pathIds: string[]) => string[];
	/**
	 * Manually re-ingests the current data. Called by refresh() in the public API.
	 */
	refresh: () => void;
	/**
	 * Adds a new item to the registry and returns its assigned ID.
	 * Does NOT mutate the user's :data prop — the engine emits the change event instead.
	 */
	createItem: (data: Omit<VobItem, 'id'>) => string;
	/**
	 * Removes items from the registry by ID.
	 * Does NOT mutate the user's :data prop.
	 * @returns The IDs that were actually removed.
	 */
	deleteItems: (ids: string[]) => string[];
	/**
	 * Patches a single item in the registry with the provided fields.
	 * Does NOT mutate the user's :data prop.
	 * @returns True if the item was found and updated; false if the ID is unknown.
	 */
	updateItem: (id: string, updates: Partial<Omit<VobItem, 'id'>>) => boolean;
	/**
	 * Moves items to a new parent folder.
	 * Silently skips any ID that doesn't exist or would create a cycle
	 * (i.e. moving a folder into one of its own descendants).
	 * @param ids      - IDs of items to move.
	 * @param parentId - The destination folder ID, or null to move to root.
	 * @returns The IDs that were actually moved.
	 */
	moveItems: (ids: string[], parentId: string | null) => string[];
	/**
	 * A counter that increments each time the registry is rebuilt from source data.
	 * Watchers can use this to detect bulk data changes vs. single-item mutations.
	 */
	registryVersion: Readonly<Ref<number>>;
	/**
	 * A counter that increments only on internal user-driven mutations
	 * (create, delete, rename, move). Does NOT increment when the registry is
	 * rebuilt from the :data prop — use this to drive onDataChanged so that
	 * feeding the emitted items back into :data does not create an update loop.
	 */
	mutationVersion: Readonly<Ref<number>>;
}

// ----------------------------------------------------------------
// Injection key (used with provide/inject in Vue)
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Creates and returns the VobEngine for a VueOmniBrowser instance.
 *
 * @param config - Reactive config ref from the parent component.
 * @param dataSpec - Reactive dataSpec ref from the parent component.
 * @param data - Reactive data ref from the parent component (array of items).
 */
export function useVobEngine(
	config: Ref<VobConfig>,
	dataSpec: Ref<VobDataSpec>,
	data: Ref<VobHierarchicalItemInput[] | VobFlatItemInput[]>,
): VobEngine {
	// The canonical flat registry. shallowRef means Vue tracks the reference
	// itself, not the contents — we replace the whole Map on each ingest for
	// predictable reactivity.
	const registry = shallowRef<Map<string, VobItem>>(new Map());

	// Incremented each time ingestData() runs a full rebuild from source data.
	const registryVersion = shallowRef(0);
	// Incremented only by internal user-driven mutations (not prop re-ingests).
	const mutationVersion = shallowRef(0);

	// ----------------------------------------------------------------
	// Ingestion
	// ----------------------------------------------------------------

	/**
	 * Rebuilds the registry from the current :data prop value.
	 * Called on mount and whenever :data changes.
	 */
	function ingestData(rawData: VobHierarchicalItemInput[] | VobFlatItemInput[]): void {
		const mode = config.value.dataMode ?? 'hierarchical';
		let newMap: Map<string, VobItem>;

		if (mode === 'flat') {
			newMap = ingestFlatItems(rawData as VobFlatItemInput[]);
		} else {
			newMap = flattenHierarchy(rawData as VobHierarchicalItemInput[], null, new Map());
		}

		registry.value = newMap;
		registryVersion.value++;
	}

	// Watch the :data prop. Deep watch is necessary so that mutations to nested
	// objects (e.g. renaming an item in a reactive array) are caught.
	// For very large datasets, users should prefer using dataLoader instead.
	watch(
		data,
		(newData) => {
			ingestData(newData);
		},
		{ deep: true, immediate: true },
	);

	// ----------------------------------------------------------------
	// Derived state
	// ----------------------------------------------------------------

	/**
	 * IDs of all root-level items, recomputed whenever the registry changes.
	 * Memoised as a computed so multiple consumers don't recompute independently.
	 */
	const rootIds = computed<string[]>(() => extractRootIds(registry.value));

	// ----------------------------------------------------------------
	// Lookup helpers
	// ----------------------------------------------------------------

	/**
	 * Returns the VobItem for the given ID, or undefined.
	 */
	function getItem(id: string): VobItem | undefined {
		return registry.value.get(id);
	}

	/**
	 * Returns visible children of the given parentId.
	 *
	 * Applies, in order:
	 *  1. `showHidden` — filters out items where hidden === true.
	 *  2. `itemFilter` — applies the user-supplied predicate.
	 */
	function getChildren(parentId: string | null): VobItem[] {
		const childIds = getChildIds(parentId, registry.value);
		const showHidden = config.value.showHidden ?? false;
		const itemFilter = config.value.itemFilter;

		return childIds.reduce<VobItem[]>((acc, id) => {
			const item = registry.value.get(id);
			if (!item) return acc;
			if (!showHidden && item.hidden) return acc;
			if (itemFilter && !itemFilter(item)) return acc;
			acc.push(item);
			return acc;
		}, []);
	}

	/**
	 * Looks up a VobTypeDefinition by slug from the current dataSpec.
	 */
	function getTypeDefinition(typeSlug: string): VobTypeDefinition | undefined {
		return dataSpec.value.types.find((t) => t.slug === typeSlug);
	}

	/**
	 * Exposes repairPath bound to the current registry.
	 * Called by useNavigation whenever registryVersion changes.
	 */
	function repairCurrentPath(pathIds: string[]): string[] {
		return repairPath(pathIds, registry.value);
	}

	// ----------------------------------------------------------------
	// Programmatic mutations
	// These only affect the internal registry and trigger the onDataChanged
	// event. They do NOT mutate the user's reactive :data prop.
	// ----------------------------------------------------------------

	/**
	 * Adds a single item to the registry.
	 * @returns The newly assigned ID.
	 */
	function createItem(data: Omit<VobItem, 'id'>): string {
		const id = generateId();
		const newItem = { id, ...data } as VobItem;

		// Build a new Map to ensure shallowRef triggers reactivity.
		const newMap = new Map(registry.value);
		newMap.set(id, newItem);
		registry.value = newMap;
		registryVersion.value++;
		mutationVersion.value++;

		return id;
	}

	/**
	 * Removes items from the registry by ID. Also removes their descendants.
	 * @returns The IDs that were actually removed (including cascaded descendants).
	 */
	function deleteItems(ids: string[]): string[] {
		const toRemove = new Set<string>();

		// Collect the target IDs plus all their descendants recursively.
		function collectDescendants(id: string): void {
			if (toRemove.has(id)) return;
			toRemove.add(id);
			for (const [childId, item] of registry.value) {
				if (item.parentId === id) collectDescendants(childId);
			}
		}

		for (const id of ids) {
			if (registry.value.has(id)) collectDescendants(id);
		}

		if (toRemove.size === 0) return [];

		const newMap = new Map(registry.value);
		for (const id of toRemove) newMap.delete(id);
		registry.value = newMap;
		registryVersion.value++;
		mutationVersion.value++;

		return [...toRemove];
	}

	/**
	 * Patches a single item in the registry with the provided fields.
	 * Triggers reactivity by replacing the registry Map reference.
	 * @returns True if the item was found and updated; false if the ID is unknown.
	 */
	function updateItem(id: string, updates: Partial<Omit<VobItem, 'id'>>): boolean {
		const item = registry.value.get(id);
		if (!item) return false;

		const newMap = new Map(registry.value);
		newMap.set(id, { ...item, ...updates } as VobItem);
		registry.value = newMap;
		registryVersion.value++;
		mutationVersion.value++;

		return true;
	}

	/**
	 * Moves items to a new parent, skipping items that don't exist or would
	 * create a cycle (a folder moved into one of its own descendants).
	 *
	 * @param ids      - IDs to move.
	 * @param parentId - Destination parent ID, or null for root.
	 * @returns The IDs that were actually moved.
	 */
	function moveItems(ids: string[], parentId: string | null): string[] {
		/**
		 * Returns all descendant IDs of the given item (recursively).
		 * Used to detect cycles (can't move a folder into its own child).
		 */
		function getDescendantIds(id: string): Set<string> {
			const result = new Set<string>();
			const stack = [id];
			while (stack.length) {
				const current = stack.pop()!;
				for (const [, item] of registry.value) {
					if (item.parentId === current) {
						result.add(item.id);
						stack.push(item.id);
					}
				}
			}
			return result;
		}

		const moved: string[] = [];
		const newMap = new Map(registry.value);

		for (const id of ids) {
			const item = newMap.get(id);
			if (!item) continue;

			// Prevent moving an item into itself or into one of its descendants.
			if (parentId !== null) {
				if (id === parentId) continue;
				if (getDescendantIds(id).has(parentId)) continue;
			}

			newMap.set(id, { ...item, parentId });
			moved.push(id);
		}

		if (moved.length) {
			registry.value = newMap;
			registryVersion.value++;
			mutationVersion.value++;
		}

		return moved;
	}

	/**
	 * Re-ingests the current :data prop value.
	 * Called by the public refresh() API and internally after async dataLoader calls.
	 */
	function refresh(): void {
		ingestData(data.value);
	}

	// ----------------------------------------------------------------
	// Return
	// ----------------------------------------------------------------

	return {
		registry,
		rootIds,
		registryVersion,
		mutationVersion,
		getItem,
		getChildren,
		getTypeDefinition,
		repairPath: repairCurrentPath,
		refresh,
		createItem,
		deleteItems,
		updateItem,
		moveItems,
	};
}
