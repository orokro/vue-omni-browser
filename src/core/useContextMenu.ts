/**
 * @file core/useContextMenu.ts
 * @description Context menu state for VueOmniBrowser.
 *
 * View components call openForItem() on right-click. This composable
 * resolves the correct menu entries from config and dataSpec, applies
 * the current selection, then exposes the open/close state for
 * VobContextMenu.vue to render.
 *
 * Entry resolution order:
 *   1. If the clicked item's type has contextMenu.override = true, use
 *      only its items.
 *   2. Otherwise start with config.contextMenu.menuItems (or built-in defaults)
 *      and append the type-specific items.
 *
 * Built-in default context menu (when nothing is configured):
 *   Open | ─── | Rename | ─── | Copy | Cut | Paste | ─── | Delete
 *
 * Injection key: VOB_CONTEXT_MENU_KEY
 */

import { ref, type Ref } from 'vue';
import type { VobItem, VobConfig, VobDataSpec, VobMenuEntry } from '../types';
import type { VobEngine } from './useVobEngine';
import type { VobNavigation } from './useNavigation';
import type { VobSelection } from './useSelection';
import type { VobClipboardState } from './useClipboard';
import { VOB } from '../constants';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface ResolvedContextEntry {
	kind: 'item' | 'separator';
	/** Unique key for v-for */
	key: string;
	label?: string;
	icon?: string;
	disabled?: boolean;
	action?: () => void;
}

export interface VobContextMenuState {
	/** True when the context menu is currently visible. */
	isOpen: Readonly<Ref<boolean>>;
	/** Viewport coordinates of the top-left corner of the menu. */
	position: Readonly<Ref<{ x: number; y: number }>>;
	/** Resolved, ready-to-render menu entries. */
	entries: Readonly<Ref<ResolvedContextEntry[]>>;

	/**
	 * Open the context menu for a right-clicked item.
	 * Resolves entries from config/dataSpec and positions the menu at the cursor.
	 */
	openForItem: (item: VobItem, event: MouseEvent) => void;

	/**
	 * Open the context menu for a right-click on the empty area of a folder view.
	 * Builds a background menu (New Folder / Select All / Paste) respecting
	 * readOnly and clipboard state.
	 *
	 * @param folderId - The parentId of the folder whose background was clicked.
	 * @param event    - The originating MouseEvent.
	 */
	openForBackground: (folderId: string | null, event: MouseEvent) => void;

	/**
	 * Open the context menu with fully custom entries (e.g. right-click on empty space).
	 */
	open: (entries: ResolvedContextEntry[], event: MouseEvent) => void;

	/** Close the context menu. */
	close: () => void;
}

// ----------------------------------------------------------------
// Default menu
// ----------------------------------------------------------------

const DEFAULT_ENTRIES: VobMenuEntry[] = [
	VOB.ACTIONS.OPEN,
	VOB.SEPARATOR,
	VOB.ACTIONS.RENAME,
	VOB.SEPARATOR,
	VOB.ACTIONS.COPY,
	VOB.ACTIONS.CUT,
	VOB.ACTIONS.PASTE,
	VOB.SEPARATOR,
	VOB.ACTIONS.DELETE,
];

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Creates and returns the context menu state for a VueOmniBrowser instance.
 */
export function useContextMenu(
	engine: VobEngine,
	navigation: VobNavigation,
	selection: VobSelection,
	clipboard: VobClipboardState,
	config: Ref<VobConfig>,
	_dataSpec: Ref<VobDataSpec>,
): VobContextMenuState {
	const isOpen   = ref(false);
	const position = ref<{ x: number; y: number }>({ x: 0, y: 0 });
	const entries  = ref<ResolvedContextEntry[]>([]);

	// ----------------------------------------------------------------
	// Entry resolution
	// ----------------------------------------------------------------

	/**
	 * Resolves a VobMenuEntry into a ResolvedContextEntry.
	 * Returns null for entries that should be skipped (unknown strings, etc.).
	 */
	function resolveEntry(raw: VobMenuEntry, index: number): ResolvedContextEntry | null {
		// Separator
		if (
			raw && typeof raw === 'object' &&
			!Array.isArray(raw) &&
			'type' in raw && (raw as { type: string }).type === 'separator'
		) {
			return { kind: 'separator', key: `sep-${index}` };
		}

		// Built-in action string
		if (typeof raw === 'string') {
			return resolveBuiltinEntry(raw, index);
		}

		// VobItemSpec
		if (raw && typeof raw === 'object' && !Array.isArray(raw) && ('name' in raw || 'onClick' in raw)) {
			const spec = raw as import('../types').VobItemSpec;
			const selectedItems = selection.selectedItems.value;
			const ctx = {
				selectedItems,
				currentFolderId: navigation.currentFolderId.value,
				currentPathIds:  navigation.currentPathIds.value,
				navigateTo: (ids: string[]) => navigation.navigateTo(ids),
				refresh: () => engine.refresh(),
			};
			return {
				kind: 'item',
				key: `spec-${index}`,
				label: spec.name ?? '',
				icon: typeof spec.icon === 'string' ? spec.icon : undefined,
				disabled: spec.disabled ?? false,
				action: spec.onClick ? () => spec.onClick!(ctx) : undefined,
			};
		}

		return null;
	}

	/**
	 * Maps a VOB.ACTIONS.* string to a resolved entry.
	 */
	function resolveBuiltinEntry(actionId: string, index: number): ResolvedContextEntry | null {
		const readOnly     = config.value.readOnly ?? false;
		const hasSelection = selection.selectedIds.value.size > 0;
		const singleSel    = selection.selectedIds.value.size === 1;
		const hasClip      = clipboard.hasClipboard.value;

		// The first selected item (used for OPEN type check)
		const firstId   = [...selection.selectedIds.value][0] ?? null;
		const firstItem = firstId ? engine.getItem(firstId) : null;
		const firstType = firstItem ? engine.getTypeDefinition(firstItem.type) : null;

		switch (actionId) {
			case VOB.ACTIONS.OPEN:
				return {
					kind: 'item', key: `open-${index}`,
					label: 'Open', icon: 'folder_open',
					disabled: !singleSel || !firstType?.hasChildren,
					action: () => {
						if (!firstItem || !firstType?.hasChildren) return;
						navigation.navigateTo([...navigation.currentPathIds.value, firstItem.id]);
						selection.clearSelection();
						close();
					},
				};

			case VOB.ACTIONS.RENAME:
				return {
					kind: 'item', key: `rename-${index}`,
					label: 'Rename', icon: 'edit',
					disabled: !singleSel || readOnly,
					action: () => {
						document.dispatchEvent(
							new CustomEvent('vob:rename-selected', { detail: { id: firstId } }),
						);
						close();
					},
				};

			case VOB.ACTIONS.COPY:
				return {
					kind: 'item', key: `copy-${index}`,
					label: 'Copy', icon: 'content_copy',
					disabled: !hasSelection || readOnly,
					action: () => {
						clipboard.copy([...selection.selectedIds.value]);
						close();
					},
				};

			case VOB.ACTIONS.CUT:
				return {
					kind: 'item', key: `cut-${index}`,
					label: 'Cut', icon: 'content_cut',
					disabled: !hasSelection || readOnly,
					action: () => {
						clipboard.cut([...selection.selectedIds.value]);
						close();
					},
				};

			case VOB.ACTIONS.PASTE:
				return {
					kind: 'item', key: `paste-${index}`,
					label: 'Paste', icon: 'content_paste',
					disabled: !hasClip || readOnly,
					action: () => {
						clipboard.paste(navigation.currentFolderId.value);
						close();
					},
				};

			case VOB.ACTIONS.DELETE:
				return {
					kind: 'item', key: `delete-${index}`,
					label: 'Delete', icon: 'delete',
					disabled: !hasSelection || readOnly,
					action: () => {
						engine.deleteItems([...selection.selectedIds.value]);
						selection.clearSelection();
						close();
					},
				};

			case VOB.ACTIONS.NEW_FOLDER:
				return {
					kind: 'item', key: `newfolder-${index}`,
					label: 'New Folder', icon: 'create_new_folder',
					disabled: readOnly,
					action: () => {
						engine.createItem({
							type: 'folder',
							name: 'New Folder',
							parentId: navigation.currentFolderId.value,
						});
						close();
					},
				};

			case VOB.ACTIONS.SELECT_ALL:
				return {
					kind: 'item', key: `selectall-${index}`,
					label: 'Select All', icon: 'select_all',
					disabled: false,
					action: () => {
						const ids = engine.getChildren(navigation.currentFolderId.value).map((i) => i.id);
						selection.selectAll(ids);
						close();
					},
				};

			default:
				return null;
		}
	}

	/**
	 * Builds the final resolved entry list for the given item.
	 */
	function buildEntries(item: VobItem): ResolvedContextEntry[] {
		const typeDef = engine.getTypeDefinition(item.type);
		const typeCtxMenu = typeDef?.contextMenu;
		const globalCfg = config.value.contextMenu;

		let rawEntries: VobMenuEntry[];

		if (typeCtxMenu?.override) {
			// Type completely overrides the global menu.
			rawEntries = typeCtxMenu.items;
		} else {
			// Start with global (or built-in defaults), append type-specific extras.
			const base = globalCfg?.menuItems ?? DEFAULT_ENTRIES;
			rawEntries = typeCtxMenu?.items ? [...base, VOB.SEPARATOR, ...typeCtxMenu.items] : [...base];
		}

		const resolved: ResolvedContextEntry[] = [];
		for (let i = 0; i < rawEntries.length; i++) {
			const entry = resolveEntry(rawEntries[i], i);
			if (!entry) continue;
			// Collapse duplicate separators.
			if (entry.kind === 'separator' && resolved.at(-1)?.kind === 'separator') continue;
			resolved.push(entry);
		}

		// Remove leading / trailing separators.
		while (resolved.length && resolved[0].kind === 'separator') resolved.shift();
		while (resolved.length && resolved.at(-1)?.kind === 'separator') resolved.pop();

		return resolved;
	}

	// ----------------------------------------------------------------
	// Open / close
	// ----------------------------------------------------------------

	function positionMenu(event: MouseEvent): { x: number; y: number } {
		// Clamp so the menu stays within the viewport (approximate — we don't
		// know the menu height yet, so we just guard the right edge for now).
		const MENU_WIDTH = 200;
		const x = Math.min(event.clientX, window.innerWidth  - MENU_WIDTH - 8);
		const y = event.clientY;
		return { x, y };
	}

	function openForItem(item: VobItem, event: MouseEvent): void {
		event.preventDefault();
		// Ensure the right-clicked item is selected.
		if (!selection.isSelected(item.id)) {
			selection.handleClick(item.id, 'none', engine.getChildren(navigation.currentFolderId.value).map((i) => i.id));
		}
		entries.value = buildEntries(item);
		position.value = positionMenu(event);
		isOpen.value = true;
	}

	function open(resolvedEntries: ResolvedContextEntry[], event: MouseEvent): void {
		event.preventDefault();
		entries.value = resolvedEntries;
		position.value = positionMenu(event);
		isOpen.value = true;
	}

	/**
	 * Builds a background context menu (New Folder / Select All / Paste) for
	 * right-clicks on the empty space inside a folder view.
	 */
	function openForBackground(folderId: string | null, event: MouseEvent): void {
		const readOnly = config.value.readOnly ?? false;
		const hasClip  = clipboard.hasClipboard.value;
		const targetId = folderId ?? navigation.currentFolderId.value;

		const bgEntries: ResolvedContextEntry[] = [
			{
				kind: 'item', key: 'bg-newfolder',
				label: 'New Folder', icon: 'create_new_folder',
				disabled: readOnly,
				action: () => {
					engine.createItem({ type: 'folder', name: 'New Folder', parentId: targetId });
					close();
				},
			},
			{ kind: 'separator', key: 'bg-sep1' },
			{
				kind: 'item', key: 'bg-selectall',
				label: 'Select All', icon: 'select_all',
				disabled: false,
				action: () => {
					const ids = engine.getChildren(targetId).map((i) => i.id);
					selection.selectAll(ids);
					close();
				},
			},
			{
				kind: 'item', key: 'bg-paste',
				label: 'Paste', icon: 'content_paste',
				disabled: !hasClip || readOnly,
				action: () => {
					clipboard.paste(targetId);
					close();
				},
			},
		];

		open(bgEntries, event);
	}

	function close(): void {
		isOpen.value = false;
	}

	return { isOpen, position, entries, openForItem, openForBackground, open, close };
}
