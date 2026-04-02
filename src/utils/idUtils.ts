/**
 * @file utils/idUtils.ts
 * @description Utilities for generating and validating item IDs.
 */

/**
 * Generates a unique ID using crypto.randomUUID() when available,
 * falling back to a timestamp + random hex string for environments
 * where the Web Crypto API is unavailable.
 *
 * @returns A unique string ID.
 */
export function generateId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	// Fallback: timestamp + 8 random hex chars
	return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * Validates that an item has a non-empty `id` field and emits a descriptive
 * warning if it does not. Does not throw — the engine continues with reduced
 * functionality for invalid items.
 *
 * @param item - The raw item object to validate.
 * @param index - The index of the item in its source array (for error context).
 * @returns True if the item has a valid id.
 */
export function validateItemId(item: Record<string, unknown>, index: number): boolean {
	if (typeof item.id !== 'string' || item.id.trim() === '') {
		console.warn(
			`[VueOmniBrowser] Item at index ${index} is missing a required "id" field and will be skipped.\n` +
			`All items must have a unique string "id" property.\n` +
			`Item name: "${item.name ?? '(unnamed)'}", type: "${item.type ?? '(no type)'}"`,
			item,
		);
		return false;
	}
	return true;
}

/**
 * Checks for duplicate IDs within a flat array of items and warns about any found.
 * Duplicate items (all but the first occurrence) are reported but NOT removed here —
 * the caller decides what to do with the result.
 *
 * @param ids - All IDs in the dataset, in order.
 * @returns A Set of IDs that appeared more than once.
 */
export function findDuplicateIds(ids: string[]): Set<string> {
	const seen = new Set<string>();
	const duplicates = new Set<string>();

	for (const id of ids) {
		if (seen.has(id)) {
			duplicates.add(id);
		}
		seen.add(id);
	}

	if (duplicates.size > 0) {
		console.warn(
			`[VueOmniBrowser] Duplicate item IDs detected. Only the first occurrence of each will be kept.\n` +
			`Duplicate IDs: ${[...duplicates].join(', ')}`,
		);
	}

	return duplicates;
}
