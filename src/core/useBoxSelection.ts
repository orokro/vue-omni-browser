/**
 * @file core/useBoxSelection.ts
 * @description Rubber-band (marquee) box selection for VueOmniBrowser content views.
 *
 * Usage:
 *   const box = useBoxSelection(containerRef, getItemRects, selection, isDragging);
 *
 * The composable attaches mousedown/mousemove/mouseup listeners to `containerRef`.
 * While dragging:
 *   - `box.rect` holds the normalised selection rect (for rendering the rubber-band overlay).
 *   - `box.isSelecting` is true so views can suppress hover effects.
 *
 * Item rects are fetched lazily via `getItemRects()` during mouse-move, so the
 * caller doesn't need to pre-compute anything — just supply a getter that returns
 * `Map<itemId, DOMRect>`.
 *
 * Modifier keys are forwarded to `selection.handleClick` semantics:
 *   - Plain drag  → replace selection with items in the box
 *   - Shift drag  → extend existing selection
 *   - Ctrl/Cmd drag → toggle items in the box
 */

import { ref, onUnmounted, type Ref } from 'vue';
import type { VobSelection } from './useSelection';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

/** Normalised screen rect used to render and hit-test the selection box. */
export interface BoxRect {
	x:      number;
	y:      number;
	width:  number;
	height: number;
}

export interface VobBoxSelectionState {
	/** True while the user is dragging a rubber-band box. */
	isSelecting: Readonly<Ref<boolean>>;
	/** Current box geometry in viewport pixels (undefined when not selecting). */
	rect: Readonly<Ref<BoxRect | undefined>>;
	/** Call this on the mousedown event of the scrollable content container. */
	onMouseDown: (event: MouseEvent) => void;
}

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Creates rubber-band box selection behaviour for a content view.
 *
 * @param containerRef  - Ref pointing at the scrollable container element.
 * @param getItemRects  - Getter that returns a Map<itemId, DOMRect> for all visible rows.
 *                        Called on each mousemove tick while selecting.
 * @param orderedIds    - Reactive ordered list of all visible item IDs (for shift-select).
 * @param selection     - VobSelection state (handleClick, selectAll, etc.).
 * @param isDragging    - Ref from useDragDrop — suppresses box selection during PNP drags.
 */
export function useBoxSelection(
	_containerRef: Ref<HTMLElement | null>,
	getItemRects:  () => Map<string, DOMRect>,
	_orderedIds:   Ref<string[]>,
	selection:     VobSelection,
	isDragging:    Ref<boolean>,
): VobBoxSelectionState {

	const isSelecting = ref(false);
	const rect        = ref<BoxRect | undefined>(undefined);

	/** Raw start point in viewport coords. */
	let startX = 0;
	let startY = 0;

	/** IDs that were selected before the box drag began (for Ctrl/Shift modes). */
	let selectionBefore: Set<string> = new Set();

	/** Modifier key held when drag started. */
	let modifier: 'none' | 'shift' | 'ctrl' = 'none';

	// ----------------------------------------------------------------
	// Hit-testing
	// ----------------------------------------------------------------

	/**
	 * Returns all item IDs whose DOM rects intersect the supplied box rect.
	 */
	function idsInBox(boxRect: BoxRect): string[] {
		const rects   = getItemRects();
		const result: string[] = [];

		for (const [id, r] of rects) {
			// AABB intersection
			if (
				r.right  > boxRect.x &&
				r.left   < boxRect.x + boxRect.width &&
				r.bottom > boxRect.y &&
				r.top    < boxRect.y + boxRect.height
			) {
				result.push(id);
			}
		}
		return result;
	}

	// ----------------------------------------------------------------
	// Mouse handlers
	// ----------------------------------------------------------------

	/**
	 * Normalises two corner points into a positive-width/height rect in
	 * viewport coordinates.
	 */
	function makeRect(x1: number, y1: number, x2: number, y2: number): BoxRect {
		return {
			x:      Math.min(x1, x2),
			y:      Math.min(y1, y2),
			width:  Math.abs(x2 - x1),
			height: Math.abs(y2 - y1),
		};
	}

	function onMouseMove(event: MouseEvent): void {
		if (!isSelecting.value) return;

		const currentRect = makeRect(startX, startY, event.clientX, event.clientY);
		rect.value = currentRect;

		// Resolve which items are in the box.
		const inBox = idsInBox(currentRect);

		if (modifier === 'ctrl') {
			// Toggle: start from prior selection, add/remove items in box.
			const next = new Set(selectionBefore);
			for (const id of inBox) {
				if (selectionBefore.has(id)) {
					next.delete(id);
				} else {
					next.add(id);
				}
			}
			selection.setSelection([...next]);
		} else if (modifier === 'shift') {
			// Extend: union of prior selection + items in box.
			const next = new Set([...selectionBefore, ...inBox]);
			selection.setSelection([...next]);
		} else {
			// Replace selection.
			selection.setSelection(inBox);
		}
	}

	function onMouseUp(event: MouseEvent): void {
		if (!isSelecting.value) return;

		// If the user actually dragged a box (not just a click that
		// happened to land on the background), suppress the trailing
		// `click` event that fires next. Otherwise any background-
		// click-to-clear handler on the content view would immediately
		// blow away the selection we just made — that's the source of
		// the "coin toss whether the selection sticks" race.
		const r = rect.value;
		const draggedBox = !!(r && (r.width > 2 || r.height > 2));

		isSelecting.value = false;
		rect.value        = undefined;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup',   onMouseUp);

		if (draggedBox) {
			// One-shot capture-phase listener — fires before any
			// "click on background → clear selection" handler bound
			// in the bubble phase, so we can swallow the click before
			// it reaches them. Removed by the same callback so it
			// only ever runs once.
			const swallowNextClick = (e: MouseEvent) => {
				e.preventDefault();
				e.stopImmediatePropagation();
				document.removeEventListener('click', swallowNextClick, true);
			};
			document.addEventListener('click', swallowNextClick, true);
			void event; // noop reference so TS doesn't drop the param if unused later
		}
	}

	// ----------------------------------------------------------------
	// Public entry point
	// ----------------------------------------------------------------

	/**
	 * Call this on the mousedown of the scrollable content container background.
	 * Ignores events on item rows (they have their own click handlers).
	 */
	function onMouseDown(event: MouseEvent): void {
		// Only handle left-button drags on the container background itself.
		if (event.button !== 0) return;
		// Never start a box during a PNP drag.
		if (isDragging.value) return;

		// Only start a box-select when the click landed on background —
		// NOT on an item row. The previous check
		//     event.target !== event.currentTarget
		// was too strict: it failed for any descendant element, even
		// purely-layout flex wrappers / spacer divs that aren't items.
		// Result was the user-visible bug "box only triggers when you
		// click directly over the row of icons; clicking the empty
		// space below does nothing."
		//
		// Walk up from the actual click target to the listener element
		// and bail only if we encounter a real item row. Each content
		// view's items carry their own marker class — currently
		// `vob-list-row`, `vob-icon-cell` (column / tree views can
		// extend this list as they grow). Anything else between the
		// target and the container counts as background.
		const ITEM_ROW_CLASSES = [
			'vob-list-row',
			'vob-icon-cell',
			'vob-tree-row',
			'vob-column-cell',
		];
		const container = event.currentTarget as Element | null;
		let walker: Element | null = event.target as Element | null;
		while (walker && walker !== container) {
			for (const cls of ITEM_ROW_CLASSES) {
				if (walker.classList?.contains(cls)) return;
			}
			walker = walker.parentElement;
		}
		// Reached the container without hitting an item row → background.

		startX = event.clientX;
		startY = event.clientY;
		modifier = event.ctrlKey || event.metaKey ? 'ctrl' : event.shiftKey ? 'shift' : 'none';
		selectionBefore = new Set(selection.selectedIds.value);

		isSelecting.value = true;
		rect.value        = undefined;

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup',   onMouseUp);
	}

	// ----------------------------------------------------------------
	// Cleanup
	// ----------------------------------------------------------------

	onUnmounted(() => {
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup',   onMouseUp);
	});

	return { isSelecting, rect, onMouseDown };
}
