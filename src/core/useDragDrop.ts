/**
 * @file core/useDragDrop.ts
 * @description Drag-and-drop state for VueOmniBrowser (vue-pick-n-plop integration).
 *
 * This composable is only active when vue-pick-n-plop is installed as a peer
 * dependency and `config.drag` is not disabled.  If PNP is not available it
 * no-ops gracefully so the browser continues to work without drag-and-drop.
 *
 * ── What this composable owns ───────────────────────────────────────────────
 *
 *  draggableOpts(item)
 *    Returns the v-pnp-draggable binding for a given VobItem.  Passes the full
 *    selection as groupCtx so multi-item drags work transparently.
 *
 *  dropzoneOpts(folderId)
 *    Returns the v-pnp-dropzone binding for a folder row or the current-folder
 *    background.  Handles:
 *      • intra-browser moves (vob:item / vob:folder → same browser instance)
 *      • inter-browser moves (vob:item / vob:folder → different instance)
 *      • external drops (vob:external → creates a new item from VobExternalDropContext)
 *
 *  isDraggingItem(itemId)
 *    Returns true while this specific item (or any co-selected item) is being
 *    dragged.  Used by view components to apply an opacity class to the origin.
 *
 *  isDragging
 *    Reactive boolean — true whenever any PNP drag is in progress.
 *
 * ── Key namespacing ─────────────────────────────────────────────────────────
 *
 *  VOB.DRAG.KEYS.ITEM   ('vob:item')   — leaf items
 *  VOB.DRAG.KEYS.FOLDER ('vob:folder') — container items
 *  VOB.DRAG.KEYS.ANY    ('vob:item|vob:folder') — any VOB item (used on dropzones)
 *  VOB.DRAG.KEYS.EXTERNAL ('vob:external') — drops from outside the browser
 *
 * ── Cycle prevention ────────────────────────────────────────────────────────
 *  The `validate` function on every folder dropzone rejects drops where the
 *  dragged items include the folder itself or any of its ancestors, preventing
 *  cycles.  Engine.moveItems() also performs cycle-detection as a safety net.
 *
 * Injection key: VOB_DRAG_DROP_KEY
 */

import { type Ref } from 'vue';
import { usePNPDragging } from 'vue-pick-n-plop';
import type { VobItem, VobConfig, VobDataSpec, VobDragContext, VobExternalDropContext } from '../types';
import type { VobEngine } from './useVobEngine';
import type { VobNavigation } from './useNavigation';
import type { VobSelection } from './useSelection';
import { VOB } from '../constants';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface VobDragDropState {
	/**
	 * Returns the v-pnp-draggable binding object for the given item.
	 * Reactive — re-evaluated when selection changes so groupCtx stays current.
	 */
	draggableOpts: (item: VobItem) => object;

	/**
	 * Returns the v-pnp-dropzone binding object for the given target.
	 *
	 * Overloads:
	 *  - Pass a `string | null` to target a specific folder by ID (or root).
	 *    Use this for background / whole-area drop zones.
	 *  - Pass a `VobItem` to target an item row. Returns `{}` (no-op) for
	 *    leaf items so only container-type rows become drop targets.
	 */
	dropzoneOpts: (folderIdOrItem: string | null | VobItem) => object;

	/**
	 * True while any PNP drag is in progress (mirrors manager.isDragging).
	 * Views use this to suppress hover / selection feedback during drags.
	 */
	isDragging: Readonly<Ref<boolean>>;

	/**
	 * Returns true if the given item ID is currently being dragged
	 * (either as the primary item or as part of a multi-select group).
	 * Used by view components to apply the dragging-origin opacity style.
	 */
	isDraggingItem: (itemId: string) => boolean;
}

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Creates and returns the drag-and-drop state for a VueOmniBrowser instance.
 *
 * @param engine      - Engine for item lookup, move, create.
 * @param navigation  - Navigation state (current path).
 * @param selection   - Selection state (selected IDs / items).
 * @param config      - Reactive config ref.
 * @param _dataSpec   - Reactive dataSpec ref (reserved for future use).
 * @param instanceId  - Unique ID for this browser instance (used in VobDragContext).
 */
export function useDragDrop(
	engine: VobEngine,
	_navigation: VobNavigation,
	selection: VobSelection,
	config: Ref<VobConfig>,
	_dataSpec: Ref<VobDataSpec>,
	instanceId: string | undefined,
): VobDragDropState {

	// ----------------------------------------------------------------
	// PNP manager
	// Resolves to the real PNP singleton when vue-pick-n-plop is installed,
	// or the inert stub manager when it is not (via the vite.config alias).
	// usePNPDragging() is an inject()-based composable and must be called
	// here (inside setup) rather than at module scope.
	// ----------------------------------------------------------------

	const manager = usePNPDragging();

	/** Reactive isDragging from the PNP manager (or always-false from the stub). */
	const isDragging = manager.isDragging as Ref<boolean>;

	// ----------------------------------------------------------------
	// Helpers
	// ----------------------------------------------------------------

	/**
	 * Derives the PNP key string for a VobItem based on whether its type
	 * is a container (hasChildren) or a leaf.
	 */
	function keyForItem(item: VobItem): string {
		const def = engine.getTypeDefinition(item.type);
		return def?.hasChildren ? VOB.DRAG.KEYS.FOLDER : VOB.DRAG.KEYS.ITEM;
	}

	/**
	 * Returns a deduplicated array of all VobItems in the current drag group.
	 * If the primary item is already selected, uses the full selection so
	 * multi-select drags carry the whole set.  Otherwise carries only the
	 * primary item (drag of an unselected item).
	 */
	function dragGroup(item: VobItem): VobItem[] {
		if (selection.isSelected(item.id)) {
			return selection.selectedItems.value;
		}
		return [item];
	}

	/**
	 * Builds the VobDragContext payload attached to every outbound draggable.
	 */
	function buildDragCtx(item: VobItem): VobDragContext {
		return {
			item,
			selectedItems: dragGroup(item),
			sourceInstanceId: instanceId,
		};
	}

	/**
	 * Returns true if moving itemIds into targetFolderId would create a cycle.
	 * (i.e. targetFolderId is one of the dragged items or their descendants.)
	 */
	function wouldCycle(itemIds: string[], targetFolderId: string): boolean {
		for (const id of itemIds) {
			if (id === targetFolderId) return true;
			// Walk descendants of this item and check if target is among them.
			const stack = [id];
			while (stack.length) {
				const current = stack.pop()!;
				for (const [, item] of engine.registry.value) {
					if (item.parentId === current) {
						if (item.id === targetFolderId) return true;
						stack.push(item.id);
					}
				}
			}
		}
		return false;
	}

	// ----------------------------------------------------------------
	// Draggable options
	// ----------------------------------------------------------------

	/**
	 * Returns the v-pnp-draggable binding for a given item row.
	 */
	function draggableOpts(item: VobItem): object {
		if (config.value.readOnly) {
			return {};
		}

		const group  = dragGroup(item);
		const ctx    = buildDragCtx(item);

		/**
		 * PNP groupCtx: the full selection array enriched with _isAnchor so
		 * custom ghost components can identify the primary item.
		 */
		const groupCtx: (VobDragContext & { _isAnchor: boolean })[] = group.map((g) => ({
			item: g,
			selectedItems: group,
			sourceInstanceId: instanceId,
			_isAnchor: g.id === item.id,
		}));

		return {
			keys:  keyForItem(item),
			ctx,
			groupCtx,
			dragItem: 'clone' as const,
			dragThreshold: 5,
		};
	}

	// ----------------------------------------------------------------
	// Dropzone options
	// ----------------------------------------------------------------

	/**
	 * Returns the v-pnp-dropzone binding for a folder row or background zone.
	 *
	 * @param folderIdOrItem - A folder ID string, null (root), or a VobItem.
	 *   When a VobItem is passed, returns {} for leaf types so only container
	 *   rows become active drop targets.
	 */
	function dropzoneOpts(folderIdOrItem: string | null | VobItem): object {
		if (config.value.readOnly) {
			return {};
		}

		let targetId: string | null;

		if (folderIdOrItem !== null && typeof folderIdOrItem === 'object') {
			// VobItem — only containers are valid drop targets.
			const def = engine.getTypeDefinition(folderIdOrItem.type);
			if (!def?.hasChildren) return {};
			targetId = folderIdOrItem.id;
		} else {
			targetId = folderIdOrItem;
		}

		return {
			// Accept any VOB item OR an external drop.
			keys: `${VOB.DRAG.KEYS.ANY}|${VOB.DRAG.KEYS.EXTERNAL}`,
			ctx: { folderId: targetId },

			/**
			 * Reject drops that would create cycles.
			 * This runs for every valid key match before the hover state is applied.
			 */
			validate: (dragCtx: unknown) => {
				// External drops are always structurally valid.
				if (!(dragCtx as VobDragContext)?.item) return true;
				if (targetId === null) return true;

				const vobCtx = dragCtx as VobDragContext;
				const dragIds = vobCtx.selectedItems.map((i) => i.id);
				return !wouldCycle(dragIds, targetId);
			},

			/**
			 * Handle a successful drop onto this folder zone.
			 */
			onDropped: (
				dragCtx: unknown,
				_dropCtx: unknown,
				groupCtx: unknown[] | null,
			) => {
				// ── External drop ───────────────────────────────────────────────
				const extCtx = dragCtx as Partial<VobExternalDropContext>;
				if (extCtx?.item && !(dragCtx as VobDragContext)?.sourceInstanceId !== undefined) {
					// Heuristic: VobDragContext has sourceInstanceId; VobExternalDropContext has item.type
					// A cleaner check: if there's no selectedItems, treat as external.
				}

				// Check if this is a VOB internal drag
				const vobCtx = dragCtx as Partial<VobDragContext>;
				if (vobCtx?.selectedItems) {
					// ── Internal VOB drag ─────────────────────────────────────────
					// Collect all dragged IDs from the group (or fall back to primary item).
					const pnpGroup = groupCtx as (VobDragContext & { _isAnchor?: boolean })[] | null;
					const idsToMove: string[] = pnpGroup
						? [...new Set(pnpGroup.flatMap((g) => g.selectedItems.map((i) => i.id)))]
						: vobCtx.selectedItems!.map((i) => i.id);

					engine.moveItems(idsToMove, targetId);
					selection.clearSelection();
					return;
				}

				// ── External drop ─────────────────────────────────────────────
				const externalCtx = dragCtx as VobExternalDropContext;
				if (externalCtx?.item) {
					engine.createItem({
						...externalCtx.item,
						parentId: targetId,
					} as Omit<VobItem, 'id'>);
				}
			},
		};
	}

	// ----------------------------------------------------------------
	// isDraggingItem
	// ----------------------------------------------------------------

	/**
	 * Returns true if itemId is part of the active drag (primary or group).
	 */
	function isDraggingItem(itemId: string): boolean {
		if (!isDragging.value) return false;
		const active = manager.activeDrag;
		const vobCtx = active.ctx as Partial<VobDragContext>;
		if (vobCtx?.selectedItems?.some((i) => i.id === itemId)) return true;
		return false;
	}

	// ----------------------------------------------------------------
	// Return
	// ----------------------------------------------------------------

	return {
		draggableOpts,
		dropzoneOpts,
		isDragging,
		isDraggingItem,
	};
}
