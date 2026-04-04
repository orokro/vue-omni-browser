/**
 * @file types.ts
 * @description All public-facing and internal TypeScript interfaces for VueOmniBrowser.
 * Import these alongside VOB when consuming or configuring the library.
 */

import type { Component } from 'vue';

// ================================================================
// Icon Spec
// ================================================================

/**
 * Describes an icon.
 * - `string` → treated as a Material Icons ligature slug (e.g. `'folder'`), OR a URL
 *   path if it starts with `/`, `./`, `../`, or `http`.
 * - `Component` → mounted directly via `<component :is="..." />`.
 */
export type VobIconSpec = string | Component;

// ================================================================
// Internal Item (the normalised, always-flat registry model)
// ================================================================

/**
 * The canonical, flat representation of every item in the registry.
 * This is what all composables and components work with internally.
 */
export interface VobItem {
	/** Unique identifier — required on all items. */
	id: string;
	/** References a slug in VobDataSpec.types. */
	type: string;
	/** Display name. Must be unique among siblings when allowDuplicateNames is false. */
	name: string;
	/** `null` for root-level items. */
	parentId: string | null;
	/** When true, hidden by default unless config.showHidden is enabled. */
	hidden?: boolean;
	/** Any additional user-defined metadata (size, createdAt, etc.). */
	[key: string]: unknown;
}

// ================================================================
// User-Provided Item Shapes (before ingestion)
// ================================================================

/**
 * Item shape when data is provided in hierarchical mode.
 * The `id` field is required; the `children` array is optional.
 */
export interface VobHierarchicalItemInput {
	id: string;
	type: string;
	name: string;
	hidden?: boolean;
	children?: VobHierarchicalItemInput[];
	[key: string]: unknown;
}

/**
 * Item shape when data is provided in flat mode.
 * Every item must have both `id` and `parentId`.
 */
export interface VobFlatItemInput {
	id: string;
	type: string;
	name: string;
	parentId: string | null;
	hidden?: boolean;
	[key: string]: unknown;
}

/** Union of both input shapes — used for the :data prop. */
export type VobItemInput = VobHierarchicalItemInput | VobFlatItemInput;

// ================================================================
// DataSpec
// ================================================================

/**
 * Defines a computed or aliased metadata column.
 * Used in the details view to render derived values or custom column labels.
 */
export interface VobMetaKeyDefinition {
	/** The key on the VobItem to read (optional if get() is provided). */
	key?: string;
	/** Column header label shown in the details view. */
	columnName: string;
	/** Returns the display value for this column given an item. */
	get: (item: VobItem) => unknown;
}

/**
 * Context-menu override attached to a specific type.
 * Items are appended to the global context menu unless `override` is true.
 */
export interface VobTypeContextMenu {
	enabled?: boolean;
	items: VobMenuEntry[];
	/** If true, completely replaces the global context menu for this type. */
	override?: boolean;
}

/**
 * Defines a single item type recognised by the browser.
 * Every item in the data references one of these slugs via its `type` field.
 */
export interface VobTypeDefinition {
	/** Unique identifier string. Referenced by VobItem.type. */
	slug: string;
	/** Human-readable label for this type (used in filters, tooltips, etc.). */
	label?: string;
	/** Icon shown next to items of this type. */
	icon?: VobIconSpec;
	/**
	 * When true, the tree view renders an expand toggle for items of this type.
	 * Also used as an optimisation hint — if false, children are never fetched.
	 */
	hasChildren?: boolean;
	/**
	 * Metadata columns available for items of this type.
	 * Strings reference top-level keys on VobItem; objects allow custom labels and getters.
	 */
	metaKeys?: Array<string | VobMetaKeyDefinition>;
	/** Type-specific context menu configuration. */
	contextMenu?: VobTypeContextMenu;
	/** Drag-and-drop key emitted when dragging items of this type. */
	drag?: { key: string };
	/** Keys this type accepts as drop targets (i.e. what can be dropped into it). */
	drop?: { accepts: string[] };
}

/**
 * The data specification object passed as the :data-spec prop.
 * Defines the vocabulary of types that can appear in the hierarchy.
 */
export interface VobDataSpec {
	types: VobTypeDefinition[];
}

// ================================================================
// Menus, Buttons & Separators
// ================================================================

/** Renders as a visual divider line. Use VOB.SEPARATOR for convenience. */
export interface VobSeparator {
	type: 'separator';
}

/**
 * Defines a custom button or menu item by specification.
 * Either `onClick` (for simple actions) or `component` (for full custom UI) must be provided.
 */
export interface VobItemSpec {
	name?: string;
	toolTipText?: string;
	icon?: VobIconSpec;
	/** Called when the item is activated (clicked, keyboard shortcut, etc.). */
	onClick?: (ctx: VobActionContext) => void;
	/** Mounted in place of the default rendering when present. */
	component?: Component;
	/** When true, the item is rendered but non-interactive. */
	disabled?: boolean;
}

/**
 * A menu/button entry is one of:
 * - A VOB.ACTIONS.* or VOB.BUTTONS.* string for built-in items
 * - A VobItemSpec for custom spec-defined items
 * - A VobSeparator (use VOB.SEPARATOR)
 * - A raw Component for fully custom rendering
 */
export type VobMenuEntry = string | VobItemSpec | VobSeparator | Component;

// ================================================================
// Context Menu Config
// ================================================================

export interface VobContextMenuConfig {
	enabled?: boolean;
	menuItems?: VobMenuEntry[];
}

// ================================================================
// Keyboard Shortcuts
// ================================================================

export interface VobKeyboardShortcut {
	/** Key names as reported by KeyboardEvent.key (e.g. 'Delete', 'F2', 'Enter'). */
	keys: string[];
	/** A VOB.ACTIONS.* string to invoke a built-in action. */
	action?: string;
	/** Custom handler, used when `action` is not provided. */
	onPress?: (ctx: VobActionContext) => void;
}

// ================================================================
// Row Definitions
// ================================================================

/** Settings for the view-mode picker in ButtonsBar. */
export interface VobViewModeSettings {
	availableViewModes?: string[];
	defaultViewMode?: string;
}

/** Settings for the zoom slider in ButtonsBar. */
export interface VobZoomSettings {
	minZoom?: number;
	maxZoom?: number;
	defaultZoom?: number;
}

/** Settings for the type filter picker in ButtonsBar. */
export interface VobFilterSettings {
	/** Type slugs (or custom labels) offered as filter options. */
	availableFilters?: string[];
	defaultFilter?: string | null;
}

export interface VobNavBarRow {
	type: 'nav-bar';
	/** CSS height string (default: '40px'). */
	height?: string;
	buttons?: VobMenuEntry[];
}

export interface VobButtonsBarRow {
	type: 'buttons-bar';
	height?: string;
	buttons?: VobMenuEntry[];
	viewModeSettings?: VobViewModeSettings;
	zoomSettings?: VobZoomSettings;
	filterSettings?: VobFilterSettings;
}

export interface VobContentRow {
	type: 'content';
	// Content area has no fixed height — it fills all remaining space.
}

export interface VobStatusBarRow {
	type: 'status-bar';
	height?: string;
	/** Returns the string displayed in the left portion of the status bar. */
	statusProvider?: (ctx: VobStatusContext) => string;
}

export interface VobCustomBarRow {
	type: 'custom-bar';
	height?: string;
	/** The Vue component to mount inside this bar. */
	component: Component;
}

export type VobRowDefinition =
	| VobNavBarRow
	| VobButtonsBarRow
	| VobContentRow
	| VobStatusBarRow
	| VobCustomBarRow;

// ================================================================
// Modal Callbacks
// ================================================================

export interface VobModals {
	/**
	 * Called when the browser needs user confirmation (e.g. before delete).
	 * Resolve with true to proceed, false to cancel.
	 * Defaults to the built-in VobModal component.
	 */
	confirm?: (message: string) => Promise<boolean>;
	/**
	 * Called when the browser needs text input from the user (e.g. naming conflicts during paste).
	 * Resolve with the entered string, or null to cancel.
	 * Defaults to the built-in VobModal component.
	 */
	prompt?: (message: string, defaultValue?: string) => Promise<string | null>;
}

// ================================================================
// Main Config
// ================================================================

/**
 * The primary configuration object passed as the :config prop.
 */
export interface VobConfig {
	/** Allow multiple items to be selected simultaneously. Default: true. */
	multiSelect?: boolean;
	/** Disables all write operations (delete, rename, copy, paste, drag-drop). Default: false. */
	readOnly?: boolean;
	/** Show items with `hidden: true`. Default: false. */
	showHidden?: boolean;
	/** Additional filter applied after `showHidden`. Return false to hide an item. */
	itemFilter?: (item: VobItem) => boolean;
	/** Controls how :data is interpreted. Default: 'hierarchical'. */
	dataMode?: 'flat' | 'hierarchical';
	/**
	 * Allows siblings to share names. When enabled:
	 * - The path input in NavBar is replaced with a breadcrumb-only display.
	 * - Path-based calls to navigateTo() emit a warning and no-op.
	 * Document this clearly for users.
	 */
	allowDuplicateNames?: boolean;
	/** Enables Material Icons font. When true, icon string slugs are rendered as ligatures. */
	enableMaterialIcons?: boolean;
	/**
	 * A non-navigable label rendered before the root breadcrumb in a muted colour.
	 * Useful for showing a display alias for the root (e.g. '%AppData%').
	 */
	virtualRoot?: string | { label: string; icon?: VobIconSpec };
	/**
	 * Async function to fetch directory contents by path.
	 * When provided alongside searchLoader, the :data prop is ignored.
	 */
	dataLoader?: (path: string) => Promise<VobFlatItemInput[]>;
	/** Async function to fetch search results by query string. */
	searchLoader?: (query: string) => Promise<VobFlatItemInput[]>;
	/** Default context menu shown on right-click. Can be overridden per-type in dataSpec. */
	contextMenu?: VobContextMenuConfig;
	/** Keyboard shortcut bindings. */
	keyboardShortcuts?: VobKeyboardShortcut[];
	/**
	 * Ordered list of rows that compose the browser layout.
	 * Must include exactly one { type: 'content' } entry.
	 */
	rows?: VobRowDefinition[];
	/** Override the built-in modal dialogs with custom implementations. */
	modals?: VobModals;

	/**
	 * Called when the user "opens" an item — by double-clicking it, pressing Enter
	 * with it selected, or choosing Open from the context menu.
	 *
	 * For container types (`hasChildren: true`) the browser navigates into the item
	 * first, then calls this callback (if provided). For leaf items the browser does
	 * nothing itself — the callback is the sole handler.
	 *
	 * Typical uses:
	 * - Preview a file in a side panel.
	 * - Follow a shortcut: read `item.meta.targetPath` and call `api.navigateTo(...)`.
	 * - Open an item in an external editor.
	 *
	 * @param item - The item that was opened.
	 * @param api  - The public VueOmniBrowser API, giving access to navigation etc.
	 */
	onOpen?: (item: VobItem, api: VobApi) => void;

	// ── Drag-and-drop integration ─────────────────────────────────────────────

	/**
	 * Groups this instance with other VueOmniBrowser instances that share the
	 * same underlying data.
	 *
	 * When an item is dragged from an instance with the **same** `dataSourceKey`,
	 * the browser treats it as an internal drag and performs a move operation
	 * (or calls `onMove` if provided).
	 *
	 * When the keys differ — or either side has no key — the drop is treated as
	 * foreign and routed to `onExternalDrop`.
	 *
	 * @example
	 * // Two browsers sharing a project folder:
	 * config: { dataSourceKey: 'project-fs', ... }
	 */
	dataSourceKey?: string;

	/**
	 * Additional PNP drag keys accepted by this browser's drop zones, beyond the
	 * built-in VOB keys (`vob:item`, `vob:folder`, `vob:external`).
	 *
	 * Use this when you want to accept drags from non-VOB sources (custom PNP
	 * draggables, ThreeJS scene outliners, colour pickers, etc.).  All such drops
	 * are routed to `onExternalDrop` — the browser never tries to auto-handle them.
	 *
	 * @example
	 * dropKeys: ['threejs:mesh', 'threejs:material', 'threejs:texture']
	 */
	dropKeys?: string[];

	/**
	 * Called when an item from a **foreign** source is dropped onto this browser.
	 *
	 * "Foreign" means any of:
	 * - A different `dataSourceKey` (independent file browser, different data set).
	 * - No `dataSourceKey` on either side (two unrelated instances).
	 * - A non-VOB PNP draggable (templates palette, ThreeJS outliner, colour picker, …).
	 *
	 * The browser makes **no internal state change** when this hook is provided —
	 * the callback is solely responsible for deciding what happens.  Call
	 * `api.createItem(...)` to add an item, `api.navigateTo(...)` to change the
	 * view, perform an async disk write, open a dialog — whatever your app needs.
	 *
	 * @param dragCtx  Raw PNP drag context.  Cast to the expected shape:
	 *                 - `VobDragContext` when the drag comes from another VOB instance.
	 *                 - `VobExternalDropContext` when using the templates pattern.
	 *                 - Your own type for fully custom draggables.
	 * @param api      The `VobApi` for this instance (`createItem`, `navigateTo`, …).
	 * @param dropCtx  Drop location: target folder ID, hovered item, current path.
	 *
	 * @example
	 * onExternalDrop(dragCtx, api, dropCtx) {
	 *   const ext = dragCtx as VobExternalDropContext;
	 *   if (ext?.item) api.createItem({ ...ext.item, parentId: dropCtx.targetFolderId });
	 * }
	 */
	onExternalDrop?: (dragCtx: unknown, api: VobApi, dropCtx: VobDropContext) => void;

	// ── Mutation interception ─────────────────────────────────────────────────
	// When any of the hooks below is provided, the browser does NOT perform the
	// corresponding internal state change — the callback owns the outcome.
	// Update the :data prop to reflect the change in the UI.
	//
	// When the hook is absent, the browser mutates its internal registry and
	// emits `onDataChanged` as usual (uncontrolled / in-memory mode).

	/**
	 * Called when items are moved (drag-drop, paste-as-move).
	 * Return nothing; update :data yourself to confirm the move.
	 */
	onMove?: (items: VobItem[], targetFolderId: string | null, api: VobApi) => void;

	/**
	 * Called when items are deleted (Delete key, context menu).
	 * Return nothing; update :data yourself to confirm the deletion.
	 */
	onDelete?: (items: VobItem[], api: VobApi) => void;

	/**
	 * Called when a single item is renamed (inline rename, context menu Rename).
	 * Return nothing; update :data yourself to confirm the rename.
	 */
	onRename?: (item: VobItem, newName: string, api: VobApi) => void;

	/**
	 * Called when a new item is created (toolbar New Folder, context menu, etc.).
	 * Return nothing; update :data yourself to confirm the creation.
	 */
	onCreate?: (type: string, name: string, parentId: string | null, api: VobApi) => void;
}

// ================================================================
// Theme
// ================================================================

/**
 * Theme object passed as the :theme prop.
 * All values map to CSS custom properties on the root browser element.
 */
export interface VobTheme {
	/** Two alternating row background colours for list/details/columns views. */
	rowColors?: [string, string];
	/** Primary accent / selection highlight colour. */
	accentColor?: string;
	/** Main background of the content area. */
	backgroundColor?: string;
	/** Background of selected items. */
	selectionColor?: string;
	/** Primary text colour. */
	textColor?: string;
	/** Muted/secondary text (used for virtual root label, meta values, etc.). */
	mutedTextColor?: string;
	/** Border / separator colour. */
	borderColor?: string;
	fontFamily?: string;
	fontSize?: string;
	iconSize?: string;
	/** Fixed row height for list and details views. */
	rowHeight?: string;
	/** Arbitrary CSS custom property overrides. Keys must start with '--'. */
	cssVars?: Record<string, string>;
}

/** Named built-in theme presets. */
export type VobThemePreset = 'light' | 'dark';

// ================================================================
// Action & Status Contexts
// ================================================================

/**
 * Passed to onClick handlers in buttons, menu items, and keyboard shortcuts.
 * Provides a snapshot of the current browser state plus imperative helpers.
 */
export interface VobActionContext {
	selectedItems: VobItem[];
	currentFolderId: string | null;
	currentPathIds: string[];
	navigateTo: (ids: string[]) => void;
	refresh: () => void;
}

/**
 * Passed to the statusProvider function in VobStatusBarRow.
 */
export interface VobStatusContext {
	/** All items in the current directory (post-filter). */
	currentItems: VobItem[];
	selectedItems: VobItem[];
	currentFolderId: string | null;
	viewMode: string;
}

// ================================================================
// Clipboard
// ================================================================

/** Internal clipboard state for copy/cut/paste operations. */
export interface VobClipboard {
	mode: 'copy' | 'cut';
	itemIds: string[];
}

// ================================================================
// Programmatic API (exposed via defineExpose on VueOmniBrowser)
// ================================================================

/**
 * The API object accessible when holding a template ref to <VueOmniBrowser />.
 * @example
 * const browser = ref<VobApi>();
 * browser.value?.navigateTo('/assets/textures');
 */
export interface VobApi {
	/**
	 * Navigate to the given location.
	 * Accepts an ID string, or a `/`-delimited path string when allowDuplicateNames is false.
	 */
	navigateTo: (pathOrId: string) => void;
	/** Returns the currently highlighted VobItem array. */
	getSelection: () => VobItem[];
	/** Programmatically selects items by ID. Clears existing selection first. */
	setSelection: (ids: string[]) => void;
	/** Re-triggers the dataLoader (or re-reads :data if no loader is configured). */
	refresh: () => void;
	/** Manually show or hide the loading overlay. */
	setLoading: (loading: boolean) => void;
	/**
	 * Inserts a new item into internal state and emits the change event.
	 * @param data - Item data without `id` (an ID is auto-generated).
	 * @param parentId - Parent item ID, or null for root.
	 */
	createItem: (data: Omit<VobItemInput, 'id'>, parentId?: string | null) => void;
	/** Removes items by ID and triggers UI cleanup (path snapping, deselection). */
	deleteItems: (ids: string[]) => void;
}

// ================================================================
// Drag and Drop (vue-pick-n-plop integration)
// ================================================================

/**
 * The data payload attached to every item dragged OUT of a VueOmniBrowser instance.
 * External drop zones that accept VOB items (keys: VOB.DRAG.KEYS.ITEM / .FOLDER / .ANY)
 * will receive this object as `dragCtx` in their PNP callbacks.
 */
export interface VobDragContext {
	/** The primary item being dragged. */
	item: VobItem;
	/**
	 * All items in the drag — includes `item` plus any co-selected items.
	 * Always an array of at least one element.
	 */
	selectedItems: VobItem[];
	/**
	 * The `instanceId` prop of the VueOmniBrowser instance the drag originated from.
	 * Useful when multiple browser instances share the same page.
	 */
	sourceInstanceId: string | undefined;
	/**
	 * The `config.dataSourceKey` of the source instance.
	 * Receiving browsers compare this against their own key to decide whether
	 * to treat the drop as a same-source move or a foreign drop.
	 */
	dataSourceKey?: string;
}

/**
 * The data payload an external draggable must provide when dropping INTO
 * a VueOmniBrowser instance (keys: VOB.DRAG.KEYS.EXTERNAL).
 *
 * Pass this as `ctx` on a v-pnp-draggable and handle it in `config.onExternalDrop`.
 * The browser makes no automatic state changes for external drops.
 */
export interface VobExternalDropContext {
	/**
	 * The item data to create.  `id` is optional — one will be auto-generated
	 * if omitted.  `parentId` is ignored (the browser sets it from the drop target).
	 */
	item: Omit<VobItemInput, 'id'> & { id?: string };
}

/**
 * Describes where in the browser an external item was dropped.
 * Passed as the third argument to `config.onExternalDrop`.
 */
export interface VobDropContext {
	/**
	 * The folder ID the item was dropped into.
	 * `null` means the item landed at the root level.
	 */
	targetFolderId: string | null;
	/**
	 * The specific VobItem hovered at the moment of the drop, if any.
	 * This is the container row the user dropped onto.
	 * Will be `null` for background / root-level drops.
	 */
	targetItem: VobItem | null;
	/**
	 * The current navigation path (array of folder IDs from the root down to
	 * the open folder at the time of the drop).
	 */
	currentPathIds: string[];
}
