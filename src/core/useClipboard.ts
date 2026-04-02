/**
 * @file core/useClipboard.ts
 * @description Cut/copy/paste clipboard state for VueOmniBrowser.
 *
 * The clipboard tracks a mode ('copy' | 'cut') and the IDs of the source items.
 * On paste, items are either cloned (copy) or moved (cut) into the target folder.
 *
 * Name conflicts during paste are resolved by calling config.modals.prompt()
 * (or the built-in modal). The user enters a new name; if they cancel, that
 * specific item is skipped.
 *
 * Items that were "cut" are visually dimmed in the UI via the `isCut` helper.
 *
 * Injection key: VOB_CLIPBOARD_KEY
 */

import { ref, computed, type Ref } from 'vue';
import type { VobConfig, VobItem, VobClipboard } from '../types';
import type { VobEngine } from './useVobEngine';
import type { VobNavigation } from './useNavigation';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface VobClipboardState {
	/** Current clipboard contents, or null if empty. */
	clipboard: Readonly<Ref<VobClipboard | null>>;
	/** True when the clipboard has items. */
	hasClipboard: Readonly<Ref<boolean>>;

	/**
	 * Stage items for copying. Does not execute the copy until paste() is called.
	 * @param ids - IDs of items to copy.
	 */
	copy: (ids: string[]) => void;

	/**
	 * Stage items for moving. Does not execute the move until paste() is called.
	 * Items are visually dimmed in the UI to indicate "pending cut" state.
	 * @param ids - IDs of items to cut.
	 */
	cut: (ids: string[]) => void;

	/**
	 * Execute the pending clipboard operation into the target folder.
	 * Handles name conflict resolution via modals.
	 * Clears the clipboard after a successful paste.
	 * @param targetParentId - The ID of the destination folder, or null for root.
	 * @returns IDs of the items that were successfully pasted.
	 */
	paste: (targetParentId: string | null) => Promise<string[]>;

	/**
	 * Returns true if the given item ID is currently staged for a cut operation.
	 * Used by view components to apply a "dimmed" visual state.
	 */
	isCut: (id: string) => boolean;

	/** Clears the clipboard without executing any operation. */
	clear: () => void;
}

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Creates and returns the clipboard state for a VueOmniBrowser instance.
 *
 * @param engine - The VobEngine instance (registry access, create/delete).
 * @param navigation - The VobNavigation instance (current folder for paste target).
 * @param config - The reactive config ref (modals, readOnly).
 */
export function useClipboard(
	engine: VobEngine,
	_navigation: VobNavigation,
	config: Ref<VobConfig>,
): VobClipboardState {
	const clipboard = ref<VobClipboard | null>(null);

	// ----------------------------------------------------------------
	// Derived
	// ----------------------------------------------------------------

	const hasClipboard = computed(() => clipboard.value !== null && clipboard.value.itemIds.length > 0);

	const cutIdSet = computed<Set<string>>(() => {
		if (!clipboard.value || clipboard.value.mode !== 'cut') return new Set();
		return new Set(clipboard.value.itemIds);
	});

	// ----------------------------------------------------------------
	// Stage operations
	// ----------------------------------------------------------------

	function copy(ids: string[]): void {
		if (ids.length === 0) return;
		clipboard.value = { mode: 'copy', itemIds: [...ids] };
	}

	function cut(ids: string[]): void {
		if (ids.length === 0) return;
		clipboard.value = { mode: 'cut', itemIds: [...ids] };
	}

	function clear(): void {
		clipboard.value = null;
	}

	function isCut(id: string): boolean {
		return cutIdSet.value.has(id);
	}

	// ----------------------------------------------------------------
	// Paste
	// ----------------------------------------------------------------

	/**
	 * Resolves a name conflict by asking the user for a new name.
	 * Returns null if the user cancels.
	 */
	async function resolveNameConflict(originalName: string, targetParentId: string | null): Promise<string | null> {
		const existingSiblings = engine.getChildren(targetParentId).map((i) => i.name);
		const promptFn = config.value.modals?.prompt;

		const message = `An item named "${originalName}" already exists in this location. Enter a new name:`;

		if (promptFn) {
			return promptFn(message, originalName);
		}

		// Fallback to browser prompt (in Phase 4 this will use VobModal).
		const result = window.prompt(message, originalName);
		if (result === null) return null;

		// Make sure the user's entered name is also unique.
		if (existingSiblings.includes(result)) {
			return resolveNameConflict(result, targetParentId);
		}
		return result;
	}

	/**
	 * Recursively clones an item and all its descendants into a new parent.
	 * Returns the new root item's ID.
	 */
	function cloneItemTree(sourceId: string, newParentId: string | null): string {
		const source = engine.getItem(sourceId);
		if (!source) return '';

		const { id: _id, parentId: _parentId, ...rest } = source;
		const newId = engine.createItem({ ...rest, parentId: newParentId });

		// Recurse into children (use raw registry children, not filtered ones).
		for (const [, item] of engine.registry.value) {
			if (item.parentId === sourceId) {
				cloneItemTree(item.id, newId);
			}
		}

		return newId;
	}

	/**
	 * Execute the clipboard operation.
	 */
	async function paste(targetParentId: string | null): Promise<string[]> {
		if (!hasClipboard.value || !clipboard.value) return [];
		if (config.value.readOnly) return [];

		const { mode, itemIds } = clipboard.value;
		const pastedIds: string[] = [];

		// Get sibling names at the target to detect conflicts.
		const existingNames = () => engine.getChildren(targetParentId).map((i) => i.name);

		for (const sourceId of itemIds) {
			const source = engine.getItem(sourceId);
			if (!source) continue;

			// Check for name conflicts.
			let finalName = source.name;
			if (existingNames().includes(finalName)) {
				const resolved = await resolveNameConflict(finalName, targetParentId);
				if (resolved === null) continue; // User cancelled this item — skip it.
				finalName = resolved;
			}

			if (mode === 'copy') {
				// Deep clone the item tree.
				const newId = cloneItemTree(sourceId, targetParentId);
				// If the name changed (conflict resolution), rename the new root.
				if (finalName !== source.name && newId) {
					const cloned = engine.getItem(newId);
					if (cloned) {
						// Rebuild the map entry with the new name.
						const newMap = new Map(engine.registry.value);
						newMap.set(newId, { ...cloned, name: finalName });
						// Direct mutation — intentional internal use only.
						(engine.registry as { value: Map<string, VobItem> }).value = newMap;
					}
				}
				if (newId) pastedIds.push(newId);
			} else {
				// Cut → move: update parentId and rename if needed.
				const item = engine.getItem(sourceId);
				if (!item) continue;

				// Prevent moving a folder into itself or one of its descendants.
				let checkId: string | null = targetParentId;
				let isSelf = false;
				while (checkId !== null) {
					if (checkId === sourceId) { isSelf = true; break; }
					checkId = engine.getItem(checkId)?.parentId ?? null;
				}
				if (isSelf) {
					console.warn(`[VueOmniBrowser] Cannot move "${item.name}" into itself.`);
					continue;
				}

				const newMap = new Map(engine.registry.value);
				newMap.set(sourceId, { ...item, parentId: targetParentId, name: finalName });
				(engine.registry as { value: Map<string, VobItem> }).value = newMap;
				pastedIds.push(sourceId);
			}
		}

		// After a cut, the clipboard is consumed. After a copy it persists
		// (mirrors OS behaviour — you can paste a copy multiple times).
		if (mode === 'cut') {
			clipboard.value = null;
		}

		return pastedIds;
	}

	// ----------------------------------------------------------------
	// Return
	// ----------------------------------------------------------------

	return {
		clipboard,
		hasClipboard,
		copy,
		cut,
		paste,
		isCut,
		clear,
	};
}
