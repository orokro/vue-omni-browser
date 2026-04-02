/**
 * @file utils/pathUtils.ts
 * @description Utilities for working with hierarchy path strings and ID path arrays.
 *
 * VueOmniBrowser uses two representations of "where you are":
 *  - `pathIds: string[]`  — an ordered array of item IDs from root → current folder.
 *    This is the canonical internal representation and always valid regardless of
 *    whether allowDuplicateNames is true.
 *  - `pathString: string` — a human-readable `/`-delimited name path (e.g. '/Assets/Textures').
 *    Only unambiguous when allowDuplicateNames is false.
 */

import type { VobItem } from '../types';

// ----------------------------------------------------------------
// Path string ↔ segments
// ----------------------------------------------------------------

/**
 * Splits a `/`-delimited path string into an array of non-empty name segments.
 *
 * @example
 * splitPath('/Assets/Textures/') // → ['Assets', 'Textures']
 * splitPath('/')                 // → []
 */
export function splitPath(path: string): string[] {
	return path.split('/').filter((s) => s.length > 0);
}

/**
 * Joins an array of name segments into a canonical path string with a leading slash.
 *
 * @example
 * joinPath(['Assets', 'Textures']) // → '/Assets/Textures'
 * joinPath([])                     // → '/'
 */
export function joinPath(segments: string[]): string {
	return '/' + segments.join('/');
}

// ----------------------------------------------------------------
// ID path → display path
// ----------------------------------------------------------------

/**
 * Converts an array of item IDs into a display path string by looking up each
 * item's name in the registry.
 *
 * @param pathIds - Ordered array of IDs from root to current folder.
 * @param registry - The flat item registry.
 * @returns A `/`-delimited display string (e.g. '/Assets/Textures').
 */
export function pathIdsToString(pathIds: string[], registry: Map<string, VobItem>): string {
	const segments = pathIds.map((id) => registry.get(id)?.name ?? id);
	return joinPath(segments);
}

/**
 * Converts a `/`-delimited path string to an array of item IDs by walking the
 * registry from root, matching each segment by name.
 *
 * This is only reliable when `allowDuplicateNames` is false. If multiple siblings
 * share a name, the first match is used.
 *
 * @param pathString - The display path to resolve (e.g. '/Assets/Textures').
 * @param registry - The flat item registry.
 * @returns The resolved ID path, or null if any segment could not be resolved.
 */
export function pathStringToIds(
	pathString: string,
	registry: Map<string, VobItem>,
): string[] | null {
	const segments = splitPath(pathString);
	const result: string[] = [];
	let parentId: string | null = null;

	for (const segment of segments) {
		const match = [...registry.values()].find(
			(item) => item.parentId === parentId && item.name === segment,
		);
		if (!match) return null;
		result.push(match.id);
		parentId = match.id;
	}

	return result;
}

// ----------------------------------------------------------------
// Path validation helpers
// ----------------------------------------------------------------

/**
 * Checks whether every ID in the given path exists in the registry AND forms a
 * valid parent→child chain.
 *
 * @param pathIds - Path to validate.
 * @param registry - The flat item registry.
 * @returns True if the entire path is valid.
 */
export function isPathValid(pathIds: string[], registry: Map<string, VobItem>): boolean {
	if (pathIds.length === 0) return true; // root is always valid

	let expectedParentId: string | null = null;
	for (const id of pathIds) {
		const item = registry.get(id);
		if (!item) return false;
		if (item.parentId !== expectedParentId) return false;
		expectedParentId = id;
	}
	return true;
}

/**
 * Finds the longest valid prefix of the given path.
 * Used to "snap" the navigation back to the nearest valid ancestor when
 * items are deleted or the data is replaced.
 *
 * @param pathIds - The current path to repair.
 * @param registry - The flat item registry.
 * @returns The longest valid prefix, which may be an empty array (root).
 */
export function repairPath(pathIds: string[], registry: Map<string, VobItem>): string[] {
	let expectedParentId: string | null = null;
	const valid: string[] = [];

	for (const id of pathIds) {
		const item = registry.get(id);
		if (!item || item.parentId !== expectedParentId) break;
		valid.push(id);
		expectedParentId = id;
	}

	return valid;
}

/**
 * Returns the IDs of all ancestors of the given item, ordered from root → direct parent.
 * Returns an empty array if the item is at root level.
 *
 * @param itemId - The item to find ancestors for.
 * @param registry - The flat item registry.
 */
export function getAncestorIds(itemId: string, registry: Map<string, VobItem>): string[] {
	const ancestors: string[] = [];
	let current = registry.get(itemId);

	while (current?.parentId !== null && current?.parentId !== undefined) {
		ancestors.unshift(current.parentId);
		current = registry.get(current.parentId);
	}

	return ancestors;
}
