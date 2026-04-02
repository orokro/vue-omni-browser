/**
 * @file utils/treeUtils.ts
 * @description Pure functions for converting hierarchical item trees into a flat
 * registry Map, and for building the flat list needed by the Tree view.
 */

import type { VobItem, VobHierarchicalItemInput, VobFlatItemInput } from '../types';
import { validateItemId, findDuplicateIds } from './idUtils';

// ----------------------------------------------------------------
// Hierarchical → Flat Registry
// ----------------------------------------------------------------

/**
 * Recursively walks a nested item tree and accumulates a flat Map<id, VobItem>.
 * Children arrays are stripped from the output; parentage is encoded via `parentId`.
 *
 * Invalid items (missing id) are skipped with a console.warn.
 * Duplicate IDs: the first occurrence is kept; subsequent duplicates are skipped.
 *
 * @param items - The array to flatten (may be nested).
 * @param parentId - The parent ID for this level (null at root).
 * @param acc - The accumulator Map (mutated in-place for performance).
 * @param indexOffset - Running item index used for warning messages.
 * @returns The same `acc` Map with all valid items added.
 */
export function flattenHierarchy(
	items: VobHierarchicalItemInput[],
	parentId: string | null,
	acc: Map<string, VobItem>,
	indexOffset: number = 0,
): Map<string, VobItem> {
	for (let i = 0; i < items.length; i++) {
		const raw = items[i] as Record<string, unknown>;
		const globalIndex = indexOffset + i;

		if (!validateItemId(raw, globalIndex)) continue;

		const id = raw.id as string;
		if (acc.has(id)) {
			console.warn(
				`[VueOmniBrowser] Duplicate ID "${id}" encountered during hierarchical ingest. ` +
				`The first occurrence is kept; this one is skipped.`,
				raw,
			);
			continue;
		}

		// Strip children from the stored item — parentage is tracked via parentId.
		const { children, ...rest } = raw as VobHierarchicalItemInput;
		acc.set(id, { ...(rest as VobItem), parentId });

		if (Array.isArray(children) && children.length > 0) {
			flattenHierarchy(children, id, acc, globalIndex + 1);
		}
	}

	return acc;
}

// ----------------------------------------------------------------
// Flat input → Flat Registry
// ----------------------------------------------------------------

/**
 * Ingests a pre-flattened item array (DATA_MODE.FLAT) into the registry Map.
 * Validates IDs and warns about duplicates.
 *
 * @param items - Raw flat items from the :data prop.
 * @returns A new Map<id, VobItem>.
 */
export function ingestFlatItems(items: VobFlatItemInput[]): Map<string, VobItem> {
	const acc = new Map<string, VobItem>();

	// Validate all IDs up front for a complete duplicate report.
	const allIds = items
		.filter((item, i) => validateItemId(item as unknown as Record<string, unknown>, i))
		.map((item) => item.id);
	const duplicates = findDuplicateIds(allIds);

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (!item.id || duplicates.has(item.id) && acc.has(item.id)) continue;
		acc.set(item.id, item as VobItem);
	}

	return acc;
}

// ----------------------------------------------------------------
// Tree view "visible flat list" computation
// ----------------------------------------------------------------

/** A single entry in the pre-computed flat list used by the tree view renderer. */
export interface TreeViewRow {
	item: VobItem;
	/** Nesting depth (0 = root). Used to calculate indent. */
	depth: number;
	/** Whether this row's children are currently expanded. */
	isExpanded: boolean;
	/** Whether this item can have children (from VobTypeDefinition.hasChildren). */
	hasChildren: boolean;
}

/**
 * Builds a flat, ordered array of TreeViewRow entries by performing a pre-order
 * traversal of the visible hierarchy.
 *
 * Only items whose ancestors are all expanded are included. This is the list that
 * the tree view renders — no virtualization is applied here; that is the
 * view's responsibility.
 *
 * @param registry - The full flat item registry.
 * @param expandedIds - Set of item IDs that are currently expanded.
 * @param hasChildrenSet - Set of type slugs where hasChildren === true.
 * @param rootIds - Ordered IDs of root-level items.
 * @returns Ordered array of rows ready for rendering.
 */
export function buildTreeRows(
	registry: Map<string, VobItem>,
	expandedIds: Set<string>,
	hasChildrenSet: Set<string>,
	rootIds: string[],
): TreeViewRow[] {
	const rows: TreeViewRow[] = [];

	function walk(ids: string[], depth: number): void {
		for (const id of ids) {
			const item = registry.get(id);
			if (!item) continue;

			const hasChildren = hasChildrenSet.has(item.type);
			const isExpanded = expandedIds.has(id);

			rows.push({ item, depth, isExpanded, hasChildren });

			if (hasChildren && isExpanded) {
				// Collect and walk children in order (children are stored in insertion order)
				const childIds = [...registry.values()]
					.filter((child) => child.parentId === id)
					.map((child) => child.id);
				walk(childIds, depth + 1);
			}
		}
	}

	walk(rootIds, 0);
	return rows;
}

// ----------------------------------------------------------------
// Root ID extraction
// ----------------------------------------------------------------

/**
 * Returns an array of IDs for all root-level items (parentId === null),
 * in insertion order.
 *
 * @param registry - The flat item registry.
 */
export function extractRootIds(registry: Map<string, VobItem>): string[] {
	const roots: string[] = [];
	for (const [id, item] of registry) {
		if (item.parentId === null) roots.push(id);
	}
	return roots;
}

/**
 * Returns an array of child IDs for the given parent, in insertion order.
 *
 * @param parentId - The parent item ID, or null for root-level items.
 * @param registry - The flat item registry.
 */
export function getChildIds(parentId: string | null, registry: Map<string, VobItem>): string[] {
	const children: string[] = [];
	for (const [id, item] of registry) {
		if (item.parentId === parentId) children.push(id);
	}
	return children;
}
