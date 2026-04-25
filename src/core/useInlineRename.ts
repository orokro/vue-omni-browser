/**
 * @file core/useInlineRename.ts
 * @description Inline rename state for VueOmniBrowser.
 *
 * Manages which item (if any) is currently being renamed and the live
 * value of the rename input field. All view components inject this to
 * render a text input in place of the item name when `renamingId` matches.
 *
 * Listens on `document` for the `vob:rename-selected` custom DOM event
 * dispatched by VobButton.vue when the built-in RENAME button is clicked.
 *
 * Injection key: VOB_INLINE_RENAME_KEY
 */

import { ref, onUnmounted, type Ref } from 'vue';
import type { VobEngine } from './useVobEngine';
import type { VobApi, VobConfig } from '../types';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface VobInlineRenameState {
	/** The ID of the item currently being renamed, or null if none. */
	renamingId: Readonly<Ref<string | null>>;
	/** The live value of the rename input. Bind to the input's v-model. */
	renameValue: Ref<string>;

	/**
	 * Begin renaming the given item. No-ops if config.readOnly is true.
	 * @param id - The item to rename.
	 */
	startRename: (id: string) => void;

	/**
	 * Commit the pending rename. Applies the trimmed renameValue to the item
	 * via engine.updateItem, then clears the renaming state.
	 * No-ops silently if renameValue is empty after trimming.
	 */
	commitRename: () => void;

	/**
	 * Abort the current rename without saving any changes.
	 */
	cancelRename: () => void;

	/**
	 * Returns true if the given item ID is currently being renamed.
	 * Convenience helper for view template conditionals.
	 */
	isRenaming: (id: string) => boolean;
}

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Creates and returns inline-rename state for a VueOmniBrowser instance.
 *
 * @param engine - The VobEngine instance (item lookup + updateItem).
 * @param config - The reactive config ref (checked for readOnly + onRename hook).
 * @param getApi - Lazy getter returning the public VobApi (avoids circular init).
 */
export function useInlineRename(
	engine: VobEngine,
	config: Ref<VobConfig>,
	getApi: () => VobApi,
): VobInlineRenameState {
	const renamingId = ref<string | null>(null);
	const renameValue = ref('');

	// ----------------------------------------------------------------
	// Actions
	// ----------------------------------------------------------------

	/**
	 * Start renaming an item. Prefills the input with the current name.
	 */
	function startRename(id: string): void {
		if (config.value.readOnly) return;
		const item = engine.getItem(id);
		if (!item) return;

		renamingId.value = id;
		renameValue.value = item.name as string;
	}

	/**
	 * Save the rename. If config.onRename is provided, delegates to the hook
	 * (controlled mode — caller owns state). Otherwise mutates via engine directly.
	 * Clears the renaming state afterwards regardless.
	 */
	function commitRename(): void {
		if (!renamingId.value) return;

		const trimmed = renameValue.value.trim();
		if (trimmed) {
			const onRename = config.value.onRename;
			if (onRename) {
				const item = engine.getItem(renamingId.value);
				if (item) {
					onRename(item, trimmed, getApi());
				}
			} else {
				engine.updateItem(renamingId.value, { name: trimmed });
			}
		}

		renamingId.value = null;
		renameValue.value = '';
	}

	/**
	 * Cancel the rename without saving.
	 */
	function cancelRename(): void {
		renamingId.value = null;
		renameValue.value = '';
	}

	/**
	 * Convenience predicate — returns true if `id` is the active rename target.
	 */
	function isRenaming(id: string): boolean {
		return renamingId.value === id;
	}

	// ----------------------------------------------------------------
	// DOM event bridge
	// VobButton.vue dispatches 'vob:rename-selected' on document with
	// detail.id so any mounted VueOmniBrowser instance can respond.
	// ----------------------------------------------------------------

	function handleRenameEvent(e: Event): void {
		const id = (e as CustomEvent<{ id: string }>).detail?.id;
		if (id) startRename(id);
	}

	document.addEventListener('vob:rename-selected', handleRenameEvent);

	onUnmounted(() => {
		document.removeEventListener('vob:rename-selected', handleRenameEvent);
	});

	// ----------------------------------------------------------------
	// Return
	// ----------------------------------------------------------------

	return {
		renamingId,
		renameValue,
		startRename,
		commitRename,
		cancelRename,
		isRenaming,
	};
}
