/**
 * @file core/useDragDrop.ts
 * @description Drag-and-drop state for VueOmniBrowser (vue-pick-n-plop integration).
 *
 * ── Drop routing ────────────────────────────────────────────────────────────
 *
 * Every drop that lands on a VOB dropzone is classified as one of two kinds:
 *
 *  SAME-SOURCE  — the drag originated from an instance with the same
 *                 `config.dataSourceKey`, or from *this exact instance*.
 *                 Result: engine.moveItems() (or config.onMove if hooked).
 *
 *  FOREIGN      — anything else:
 *                 • Different / absent dataSourceKey
 *                 • Non-VOB draggable (templates palette, ThreeJS outliner, …)
 *                 Result: config.onExternalDrop() if provided, otherwise no-op.
 *
 * ── Key namespacing ─────────────────────────────────────────────────────────
 *
 *  VOB.DRAG.KEYS.ITEM     ('vob:item')           — leaf items
 *  VOB.DRAG.KEYS.FOLDER   ('vob:folder')          — container items
 *  VOB.DRAG.KEYS.ANY      ('vob:item|vob:folder') — any VOB item (used on dropzones)
 *  VOB.DRAG.KEYS.EXTERNAL ('vob:external')        — external templates pattern
 *  config.dropKeys        — extra keys for custom PNP draggables
 *
 * ── Cycle prevention ────────────────────────────────────────────────────────
 *  The `validate` function on every folder dropzone rejects same-source drops
 *  where the dragged items include the folder itself or any of its ancestors.
 *  engine.moveItems() performs a second cycle-check as a safety net.
 *
 * Injection key: VOB_DRAG_DROP_KEY
 */

import { type Ref } from 'vue';
import { usePNPDragging } from 'vue-pick-n-plop';
import type {
	VobItem,
	VobConfig,
	VobDataSpec,
	VobDragContext,
	VobDropContext,
	VobApi,
} from '../types';
import type { VobEngine } from './useVobEngine';
import type { VobNavigation } from './useNavigation';
import type { VobSelection } from './useSelection';
import { VOB } from '../constants';

// ----------------------------------------------------------------
// Public interface
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
	 *    leaf items so only container-type rows become active drop targets.
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
 * @param navigation  - Navigation state (used to populate VobDropContext.currentPathIds).
 * @param selection   - Selection state (selected IDs / items).
 * @param config      - Reactive config ref.
 * @param _dataSpec   - Reactive dataSpec ref (reserved for future use).
 * @param instanceId  - Unique ID for this browser instance.
 * @param getApi      - Lazy getter that returns the VobApi for this instance.
 *                      Must be a getter (not the value) to avoid a circular
 *                      reference during component setup.
 */
export function useDragDrop(
	engine:     VobEngine,
	navigation: VobNavigation,
	selection:  VobSelection,
	config:     Ref<VobConfig>,
	_dataSpec:  Ref<VobDataSpec>,
	instanceId: string | undefined,
	getApi:     () => VobApi,
): VobDragDropState {

	// ----------------------------------------------------------------
	// PNP manager
	// ----------------------------------------------------------------

	const manager   = usePNPDragging();
	const isDragging = manager.isDragging as Ref<boolean>;

	// ----------------------------------------------------------------
	// Key helpers
	// ----------------------------------------------------------------

	/**
	 * Derives the PNP key string for a VobItem based on its type definition.
	 */
	function keyForItem(item: VobItem): string {
		const def = engine.getTypeDefinition(item.type);
		return def?.hasChildren ? VOB.DRAG.KEYS.FOLDER : VOB.DRAG.KEYS.ITEM;
	}

	/**
	 * Builds the complete key string for a dropzone, merging built-in VOB
	 * keys with any extra keys from config.dropKeys.
	 */
	function dropzoneKeys(): string {
		const base  = `${VOB.DRAG.KEYS.ANY}|${VOB.DRAG.KEYS.EXTERNAL}`;
		const extra = config.value.dropKeys?.join('|');
		return extra ? `${base}|${extra}` : base;
	}

	// ----------------------------------------------------------------
	// Drag group helpers
	// ----------------------------------------------------------------

	/**
	 * Returns a deduplicated array of all VobItems in the current drag group.
	 * If the primary item is already selected, uses the full selection so
	 * multi-select drags carry the whole set.  Otherwise carries only the
	 * primary item (drag of an unselected item).
	 */
	function dragGroup(item: VobItem): VobItem[] {
		return selection.isSelected(item.id) ? selection.selectedItems.value : [item];
	}

	/**
	 * Builds the VobDragContext payload attached to every outbound draggable.
	 */
	function buildDragCtx(item: VobItem): VobDragContext {
		return {
			item,
			selectedItems:    dragGroup(item),
			sourceInstanceId: instanceId,
			dataSourceKey:    config.value.dataSourceKey,
		};
	}

	// ----------------------------------------------------------------
	// Source-identity helpers
	// ----------------------------------------------------------------

	/**
	 * Returns true when the drag came from *this exact instance*.
	 */
	function isSameInstance(vobCtx: VobDragContext): boolean {
		return instanceId !== undefined && vobCtx.sourceInstanceId === instanceId;
	}

	/**
	 * Returns true when both this instance and the drag source have the same
	 * non-empty dataSourceKey — meaning they share a common data set.
	 */
	function isSameSource(vobCtx: VobDragContext): boolean {
		const myKey   = config.value.dataSourceKey;
		const their   = vobCtx.dataSourceKey;
		return !!(myKey && their && myKey === their);
	}

	// ----------------------------------------------------------------
	// Drop context builder
	// ----------------------------------------------------------------

	/**
	 * Builds a VobDropContext from a target folder ID.
	 * @param targetFolderId - The folder ID the item was dropped into (null = root).
	 */
	function buildDropCtx(targetFolderId: string | null): VobDropContext {
		return {
			targetFolderId,
			targetItem:   targetFolderId ? (engine.getItem(targetFolderId) ?? null) : null,
			currentPathIds: [...navigation.currentPathIds.value],
		};
	}

	// ----------------------------------------------------------------
	// Cycle detection
	// ----------------------------------------------------------------

	/**
	 * Returns true if moving itemIds into targetFolderId would create a cycle
	 * (i.e. targetFolderId is one of the dragged items or their descendants).
	 */
	function wouldCycle(itemIds: string[], targetFolderId: string): boolean {
		for (const id of itemIds) {
			if (id === targetFolderId) return true;
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
		if (config.value.readOnly) return {};

		const group    = dragGroup(item);
		const ctx      = buildDragCtx(item);
		const groupCtx = group.map((g) => ({
			item:             g,
			selectedItems:    group,
			sourceInstanceId: instanceId,
			dataSourceKey:    config.value.dataSourceKey,
			_isAnchor:        g.id === item.id,
		}));

		return {
			keys:          keyForItem(item),
			ctx,
			groupCtx,
			dragItem:      'clone' as const,
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
		if (config.value.readOnly) return {};

		let targetId: string | null;

		if (folderIdOrItem !== null && typeof folderIdOrItem === 'object') {
			const def = engine.getTypeDefinition(folderIdOrItem.type);
			if (!def?.hasChildren) return {};
			targetId = folderIdOrItem.id;
		} else {
			targetId = folderIdOrItem;
		}

		return {
			keys: dropzoneKeys(),
			ctx:  { folderId: targetId },

			/**
			 * Reject same-source drops that would create folder cycles.
			 * Foreign drops are always structurally valid (we won't move anything).
			 */
			validate: (dragCtx: unknown) => {
				const vobCtx = dragCtx as Partial<VobDragContext>;
				if (!vobCtx?.selectedItems) return true; // non-VOB drag — always pass
				if (targetId === null) return true;      // root drop — always pass

				// Only cycle-check if the drop would actually be a same-source move.
				if (!isSameInstance(vobCtx as VobDragContext) && !isSameSource(vobCtx as VobDragContext)) {
					return true;
				}

				const dragIds = vobCtx.selectedItems.map((i) => i.id);
				return !wouldCycle(dragIds, targetId);
			},

			/**
			 * Handle a successful drop onto this folder zone.
			 */
			onDropped: (
				dragCtx:  unknown,
				_dropCtx: unknown,
				groupCtx: unknown[] | null,
			) => {
				const vobCtx = dragCtx as Partial<VobDragContext>;

				// ── VOB drag ─────────────────────────────────────────────────────
				if (vobCtx?.selectedItems) {
					const isOurs = isSameInstance(vobCtx as VobDragContext) || isSameSource(vobCtx as VobDragContext);

					if (isOurs) {
						// Same data source → move (or delegate to onMove hook).
						const pnpGroup = groupCtx as (VobDragContext & { _isAnchor?: boolean })[] | null;
						const idsToMove: string[] = pnpGroup
							? [...new Set(pnpGroup.flatMap((g) => g.selectedItems.map((i) => i.id)))]
							: (vobCtx as VobDragContext).selectedItems.map((i) => i.id);

						// Filter out items whose name already exists in the target folder.
						// (Drag-drop is synchronous, so we can't prompt — skip conflicts.)
						const targetSiblingNames = new Set(
							engine.getChildren(targetId).map((i) => i.name),
						);
						const safeIds = idsToMove.filter((id) => {
							const item = engine.getItem(id);
							if (!item) return false;
							// Skip if an item with the same name already lives in target
							// AND it isn't the item itself moving within the same parent.
							if (targetSiblingNames.has(item.name) && item.parentId !== targetId) {
								console.warn(
									`[VueOmniBrowser] Drag blocked: "${item.name}" already exists in the target folder.`,
								);
								return false;
							}
							return true;
						});

						if (safeIds.length === 0) {
							return;
						}

						const onMove = config.value.onMove;
						if (onMove) {
							const items = safeIds
								.map((id) => engine.getItem(id))
								.filter((i): i is VobItem => i !== undefined);
							onMove(items, targetId, getApi());
						} else {
							engine.moveItems(safeIds, targetId);
						}

						selection.clearSelection();
						return;
					}

					// Cross-source VOB drag → treat as external.
					config.value.onExternalDrop?.(dragCtx, getApi(), buildDropCtx(targetId));
					return;
				}

				// ── Non-VOB drag (templates, custom PNP, etc.) ───────────────────
				config.value.onExternalDrop?.(dragCtx, getApi(), buildDropCtx(targetId));
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
		return vobCtx?.selectedItems?.some((i) => i.id === itemId) ?? false;
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
