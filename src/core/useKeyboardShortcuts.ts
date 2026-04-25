/**
 * @file core/useKeyboardShortcuts.ts
 * @description Keyboard shortcut handling for VueOmniBrowser.
 *
 * Attaches a single keydown listener to `document`. Only processes events
 * when focus is within the browser's container element (or on document.body
 * with no other focused element), so it doesn't steal keystrokes from the
 * surrounding page.
 *
 * Built-in shortcuts:
 *   Delete / Backspace  → delete selected items
 *   F2                  → start inline rename on single selected item
 *   Ctrl/Cmd + C        → copy selection
 *   Ctrl/Cmd + X        → cut selection
 *   Ctrl/Cmd + V        → paste into current folder
 *   Ctrl/Cmd + A        → select all visible items in current folder
 *   Escape              → cancel rename OR clear selection
 *   Enter               → navigate into selected folder
 *
 * User-defined shortcuts are read from config.keyboardShortcuts.
 * Each entry specifies keys[], an optional VOB.ACTIONS.* string, and an
 * optional onPress callback. Built-ins take precedence.
 */

import { onUnmounted, type Ref } from 'vue';
import type { VobConfig, VobDataSpec } from '../types';
import type { VobEngine } from './useVobEngine';
import type { VobNavigation } from './useNavigation';
import type { VobSelection } from './useSelection';
import type { VobSortFilter } from './useSortFilter';
import type { VobClipboardState } from './useClipboard';
import type { VobInlineRenameState } from './useInlineRename';
import type { VobModalState } from './useVobModal';
import type { VobOpenItemState } from './useOpenItem';
import { VOB } from '../constants';

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Registers keyboard shortcuts for a VueOmniBrowser instance.
 * This composable has no return value — it registers side effects only.
 *
 * @param containerRef - Ref pointing at the root .vob-container element.
 * @param engine       - VobEngine instance.
 * @param navigation   - VobNavigation instance.
 * @param selection    - VobSelection instance.
 * @param sortFilter   - VobSortFilter instance (for visible-item ordering).
 * @param clipboard    - VobClipboardState instance.
 * @param inlineRename - VobInlineRenameState instance.
 * @param config       - Reactive config ref.
 * @param dataSpec     - Reactive dataSpec ref.
 */
export function useKeyboardShortcuts(
	containerRef: Ref<HTMLElement | null>,
	engine: VobEngine,
	navigation: VobNavigation,
	selection: VobSelection,
	sortFilter: VobSortFilter,
	clipboard: VobClipboardState,
	inlineRename: VobInlineRenameState,
	config: Ref<VobConfig>,
	dataSpec: Ref<VobDataSpec>,
	modal: VobModalState,
	openItem: VobOpenItemState['openItem'],
): void {
	// ----------------------------------------------------------------
	// Helpers
	// ----------------------------------------------------------------

	/** Returns true only when focus is inside our container (or on body). */
	function isFocusedInContainer(): boolean {
		const container = containerRef.value;
		if (!container) return false;
		const active = document.activeElement;
		if (!active || active === document.body) return true;
		return container.contains(active);
	}

	/** Returns visible items in the current folder, sorted. */
	function visibleItems() {
		return sortFilter.applyToItems(
			engine.getChildren(navigation.currentFolderId.value),
			dataSpec.value,
		);
	}

	/** Builds a VobActionContext object for custom shortcut callbacks. */
	function makeActionContext() {
		return {
			selectedItems: selection.selectedItems.value,
			currentFolderId: navigation.currentFolderId.value,
			currentPathIds: navigation.currentPathIds.value,
			navigateTo: (ids: string[]) => navigation.navigateTo(ids),
			refresh: () => engine.refresh(),
		};
	}

	// ----------------------------------------------------------------
	// Built-in handler
	// ----------------------------------------------------------------

	/**
	 * Attempt to handle a keydown event as a built-in shortcut.
	 * Returns true if the event was consumed (i.e. we handled the key, even
	 * if the async delete is still pending confirmation).
	 */
	function handleBuiltin(event: KeyboardEvent): boolean {
		const cfg      = config.value;
		const readOnly = cfg.readOnly ?? false;
		const hasSel   = selection.selectedIds.value.size > 0;
		const singleSel = selection.selectedIds.value.size === 1;
		const isRenaming = inlineRename.renamingId.value !== null;
		const ctrl = event.ctrlKey || event.metaKey;

		// Escape: cancel rename first, then clear selection.
		if (event.key === 'Escape') {
			if (isRenaming) {
				event.preventDefault();
				inlineRename.cancelRename();
				return true;
			}
			if (hasSel) {
				event.preventDefault();
				selection.clearSelection();
				return true;
			}
		}

		// Don't handle anything else while renaming — the rename input owns the keyboard.
		if (isRenaming) return false;

		// Delete / Backspace → confirm then delete selected
		if ((event.key === 'Delete' || event.key === 'Backspace') && !ctrl) {
			if (hasSel && !readOnly) {
				event.preventDefault();
				const count = selection.selectedIds.value.size;
				const label = count === 1 ? '1 item' : `${count} items`;
				const ids = [...selection.selectedIds.value];
				modal.confirm(`Delete ${label}?`).then((confirmed) => {
					if (!confirmed) return;
					engine.deleteItems(ids);
					selection.clearSelection();
				});
				return true;
			}
		}

		// F2 → inline rename
		if (event.key === 'F2') {
			if (singleSel && !readOnly) {
				event.preventDefault();
				const id = [...selection.selectedIds.value][0];
				inlineRename.startRename(id);
				return true;
			}
		}

		// Ctrl+C → copy
		if (ctrl && event.key === 'c') {
			if (hasSel && !readOnly) {
				event.preventDefault();
				clipboard.copy([...selection.selectedIds.value]);
				return true;
			}
		}

		// Ctrl+X → cut
		if (ctrl && event.key === 'x') {
			if (hasSel && !readOnly) {
				event.preventDefault();
				clipboard.cut([...selection.selectedIds.value]);
				return true;
			}
		}

		// Ctrl+V → paste
		if (ctrl && event.key === 'v') {
			if (clipboard.hasClipboard.value && !readOnly) {
				event.preventDefault();
				clipboard.paste(navigation.currentFolderId.value);
				return true;
			}
		}

		// Ctrl+A → select all
		if (ctrl && event.key === 'a') {
			event.preventDefault();
			selection.selectAll(visibleItems().map((i) => i.id));
			return true;
		}

		// Enter → open selected item (navigate for containers, fire onOpen for all).
		if (event.key === 'Enter' && singleSel) {
			const id   = [...selection.selectedIds.value][0];
			const item = engine.getItem(id);
			if (item) {
				event.preventDefault();
				openItem(item);
				return true;
			}
		}

		// ArrowDown / ArrowUp — move or extend selection through the visible item list.
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			const items = visibleItems();
			if (items.length === 0) return false;

			event.preventDefault();

			const isDown   = event.key === 'ArrowDown';
			const ids      = items.map((i) => i.id);
			const selIds   = [...selection.selectedIds.value];

			// Determine the "anchor" — the item we move away from.
			// Use the last selected item for down, first for up (mirrors OS behaviour).
			let anchorIdx  = -1;
			if (selIds.length > 0) {
				const pivot = isDown ? selIds[selIds.length - 1] : selIds[0];
				anchorIdx = ids.indexOf(pivot);
			}

			const nextIdx = anchorIdx === -1
				? (isDown ? 0 : ids.length - 1)
				: Math.max(0, Math.min(ids.length - 1, anchorIdx + (isDown ? 1 : -1)));

			const nextId = ids[nextIdx];
			if (event.shiftKey) {
				// Extend the selection to include the next item.
				selection.handleClick(nextId, 'shift', ids);
			} else {
				// Move selection to the next item exclusively.
				selection.handleClick(nextId, 'none', ids);
			}
			return true;
		}

		return false;
	}

	// ----------------------------------------------------------------
	// User-defined shortcut handler
	// ----------------------------------------------------------------

	/**
	 * Attempt to match and run a user-defined shortcut.
	 * Returns true if the event was consumed.
	 */
	function handleUserDefined(event: KeyboardEvent): boolean {
		const shortcuts = config.value.keyboardShortcuts;
		if (!shortcuts?.length) return false;

		for (const shortcut of shortcuts) {
			if (!shortcut.keys.includes(event.key)) continue;

			event.preventDefault();

			if (shortcut.action) {
				// Map action string to a built-in operation.
				const readOnly = config.value.readOnly ?? false;
				const hasSel   = selection.selectedIds.value.size > 0;

				switch (shortcut.action) {
					case VOB.ACTIONS.DELETE:
						if (hasSel && !readOnly) {
							const count = selection.selectedIds.value.size;
							const label = count === 1 ? '1 item' : `${count} items`;
							const ids = [...selection.selectedIds.value];
							modal.confirm(`Delete ${label}?`).then((confirmed) => {
								if (!confirmed) return;
								engine.deleteItems(ids);
								selection.clearSelection();
							});
						}
						break;
					case VOB.ACTIONS.RENAME:
						if (selection.selectedIds.value.size === 1 && !readOnly) {
							inlineRename.startRename([...selection.selectedIds.value][0]);
						}
						break;
					case VOB.ACTIONS.COPY:
						if (hasSel && !readOnly) clipboard.copy([...selection.selectedIds.value]);
						break;
					case VOB.ACTIONS.CUT:
						if (hasSel && !readOnly) clipboard.cut([...selection.selectedIds.value]);
						break;
					case VOB.ACTIONS.PASTE:
						if (clipboard.hasClipboard.value && !readOnly) {
							clipboard.paste(navigation.currentFolderId.value);
						}
						break;
					case VOB.ACTIONS.SELECT_ALL:
						selection.selectAll(visibleItems().map((i) => i.id));
						break;
					case VOB.ACTIONS.NEW_FOLDER:
						if (!readOnly) {
							const folderName = engine.uniqueChildName('New Folder', navigation.currentFolderId.value);
							const id = engine.createItem({
								type: 'folder',
								name: folderName,
								parentId: navigation.currentFolderId.value,
							});
							if (id) {
								setTimeout(() => {
									document.dispatchEvent(
										new CustomEvent('vob:rename-selected', { detail: { id } }),
									);
								}, 0);
							}
						}
						break;
				}
			} else if (shortcut.onPress) {
				shortcut.onPress(makeActionContext());
			}

			return true;
		}

		return false;
	}

	// ----------------------------------------------------------------
	// Listener
	// ----------------------------------------------------------------

	function onKeydown(event: KeyboardEvent): void {
		if (!isFocusedInContainer()) return;
		// User-defined shortcuts run first so they can override built-ins.
		if (handleUserDefined(event)) return;
		handleBuiltin(event);
	}

	document.addEventListener('keydown', onKeydown);

	onUnmounted(() => {
		document.removeEventListener('keydown', onKeydown);
	});
}
