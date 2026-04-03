/**
 * @file types/vue-pick-n-plop.d.ts
 * @description TypeScript declarations for the vue-pick-n-plop drag-and-drop library.
 *
 * vue-pick-n-plop is authored in plain JavaScript. These declarations provide
 * type safety for the subset of the API used by VueOmniBrowser.
 *
 * Full API docs: https://github.com/geemiller/vue-pick-n-plop
 */

declare module 'vue-pick-n-plop' {
	import type { App, Component, Ref, Directive } from 'vue';

	// ----------------------------------------------------------------
	// Drag manager state
	// ----------------------------------------------------------------

	export interface PNPModifiers {
		shiftKey?: boolean;
		ctrlKey?: boolean;
		altKey?: boolean;
		metaKey?: boolean;
	}

	export interface PNPActiveDrag<TDragCtx = unknown, TDropCtx = unknown> {
		el: HTMLElement | null;
		keys: string[];
		ctx: TDragCtx;
		/** Full selection when multi-select is active; null for single-item drags. */
		groupCtx: TDragCtx[] | null;
		startMouse: { x: number; y: number };
		currentMouse: { x: number; y: number };
		delta: { x: number; y: number };
		initialRect: DOMRect | null;
		currentDropZone: PNPDropZone<TDropCtx> | null;
		validDropZones: PNPDropZone<TDropCtx>[];
		modifiers: PNPModifiers;
		sortPlaceholder: HTMLElement | null;
		sortOriginZoneId: string | null;
		sortFromIndex: number;
	}

	export interface PNPDropZone<TCtx = unknown> {
		id: string;
		el: HTMLElement;
		keys: string;
		ctx?: TCtx;
		sortable?: boolean;
		orientation?: 'vertical' | 'horizontal';
		placeholder?: 'space' | 'line' | 'dashed';
		validate?: (dragCtx: unknown) => boolean;
		onDropped?: (dragCtx: unknown, dropCtx: TCtx | undefined, groupCtx: unknown[] | null, modifiers: PNPModifiers) => void;
		onSortDrop?: (dragCtx: unknown, dropCtx: TCtx | undefined, fromIndex: number, toIndex: number, groupCtx: unknown[] | null, modifiers: PNPModifiers) => void;
		onHover?: (dragCtx: unknown, dropCtx: TCtx | undefined) => void;
	}

	export interface PNPDragManager<TDragCtx = unknown, TDropCtx = unknown> {
		isDragging: Ref<boolean>;
		dragZones: Ref<PNPDropZone[]>;
		hasDragLayer: Ref<number>;
		hoveredZoneId: Ref<string | null>;
		dragId: Ref<number>;
		activeDrag: PNPActiveDrag<TDragCtx, TDropCtx>;

		startDrag(el: HTMLElement, options: PNPDraggableOptions, event?: MouseEvent | PointerEvent): void;
		cancelDrag(): void;
		setOptions(opts: Partial<PNPManagerOptions>): void;
		registerDropZone(zone: Omit<PNPDropZone, 'id'> & { id: string }): void;
		unregisterDropZone(id: string): void;
		registerDropLayer(): void;
		unregisterDropLayer(): void;
		onDragStart(fn: (ctx: TDragCtx, groupCtx: TDragCtx[] | null, modifiers: PNPModifiers) => void): void;
		offDragStart(fn: Function): void;
		onDropped(fn: (event: { success: boolean; dragCtx: TDragCtx; dropCtx: TDropCtx | null; groupCtx: TDragCtx[] | null; modifiers: PNPModifiers }) => void): void;
		offDropped(fn: Function): void;
	}

	// ----------------------------------------------------------------
	// Options
	// ----------------------------------------------------------------

	export interface PNPManagerOptions {
		/** Key that cancels an active drag. null to disable. Default: 'Escape' */
		cancelKey: string | null;
		/** Right-click during drag cancels it. Default: true */
		rightClickCancel: boolean;
		/** Enable pointer events for touch/stylus. Default: false */
		useTouch: boolean;
		/** Minimum pixel movement before drag begins. Default: 5 */
		dragThreshold: number;
	}

	export interface PNPDraggableOptions<TCtx = unknown> {
		/**
		 * Pipe-separated key string (e.g. 'file|image'). Must match a drop zone.
		 * Optional — omit (or pass `{}`) to disable dragging on this element.
		 */
		keys?: string;
		/** Data payload for this item. Passed to all callbacks. */
		ctx?: TCtx;
		/** Array of data for a multi-selection drag. */
		groupCtx?: TCtx[] | null;
		/**
		 * Visual drag mode.
		 * - 'self'      Original DOM element moves.
		 * - 'clone'     DOM clone follows cursor; original stays.
		 * - Component   Custom Vue component rendered in the drag layer.
		 * - string      Plain text badge.
		 */
		dragItem?: 'self' | 'clone' | Component | string;
		/** Minimum pixels to move before drag starts. Overrides manager default. */
		dragThreshold?: number;
		/** If true, drag only starts from a v-pnp-draghandle child. */
		requireHandle?: boolean;
		/** Show a "+N" count badge on clone-mode ghosts when groupCtx has >1 item. */
		showGroupCount?: boolean;
		/** Highlight mode for valid drop zones. Default: 'on-hover'. */
		highlight?: 'on-start' | 'on-hover';
		/** Called when drag begins. */
		onDragStart?: (ctx: TCtx, groupCtx: TCtx[] | null, modifiers: PNPModifiers) => void;
		/** Called when drag ends (success=true means item was dropped on a valid zone). */
		onDropped?: (success: boolean, dragCtx: TCtx, dropCtx: unknown, groupCtx: TCtx[] | null, modifiers: PNPModifiers) => void;
		/** Dynamic validation: return false to prevent this item from starting a drag. */
		validate?: (zoneCtx: unknown) => boolean;
	}

	export interface PNPDropzoneOptions<TCtx = unknown> {
		/**
		 * Pipe-separated key string. Items with matching keys are accepted.
		 * Optional — omit (or pass `{}`) to disable this drop zone.
		 */
		keys?: string;
		/** Data payload for this zone. Passed to drop callbacks. */
		ctx?: TCtx;
		/** Enable list reordering. Default: false. */
		sortable?: boolean;
		/** Axis for sort midpoint calculation. Default: 'vertical'. */
		orientation?: 'vertical' | 'horizontal';
		/** Visual style of the sort insertion placeholder. Default: 'space'. */
		placeholder?: 'space' | 'line' | 'dashed';
		/** Dynamic drop validation. Return false to reject an incoming drag. */
		validate?: (dragCtx: unknown) => boolean;
		/** Called when an item is dropped onto this zone. */
		onDropped?: (dragCtx: unknown, dropCtx: TCtx | undefined, groupCtx: unknown[] | null, modifiers: PNPModifiers) => void;
		/** Called when a sortable reorder completes. */
		onSortDrop?: (dragCtx: unknown, dropCtx: TCtx | undefined, fromIndex: number, toIndex: number, groupCtx: unknown[] | null, modifiers: PNPModifiers) => void;
		/** Called when a valid drag first enters this zone. */
		onHover?: (dragCtx: unknown, dropCtx: TCtx | undefined) => void;
	}

	// ----------------------------------------------------------------
	// Components & directives
	// ----------------------------------------------------------------

	export const PNPDragLayer: Component;

	export const vPnpDraggable: Directive<HTMLElement, PNPDraggableOptions>;
	export const vPnpDropzone: Directive<HTMLElement, PNPDropzoneOptions>;
	export const vPnpDraghandle: Directive<HTMLElement, void>;

	// ----------------------------------------------------------------
	// Composable
	// ----------------------------------------------------------------

	/** Returns the active PNPDragManager (injected by the plugin, or the singleton). */
	export function usePNPDragging(): PNPDragManager;

	// ----------------------------------------------------------------
	// Plugin
	// ----------------------------------------------------------------

	declare const PNP: {
		install(app: App, options?: Partial<PNPManagerOptions>): void;
	};
	export default PNP;
}
