/**
 * @file constants.ts
 * @description Global VOB enum/constant object exported as the primary namespace
 * for all built-in row types, view modes, actions, buttons, and data modes.
 */

export const VOB = {
	/** Row type identifiers for use in config.rows */
	ROWS: {
		NAV_BAR: 'nav-bar',
		BUTTONS_BAR: 'buttons-bar',
		CONTENT: 'content',
		STATUS_BAR: 'status-bar',
		CUSTOM_BAR: 'custom-bar',
	},

	/** Content area view mode identifiers */
	VIEW_MODES: {
		LIST: 'list',
		DETAILS: 'details',
		ICONS: 'icons',
		TREE: 'tree',
		COLUMNS: 'columns',
	},

	/** Built-in action identifiers, usable in context menus and keyboard shortcuts */
	ACTIONS: {
		OPEN: 'open',
		DELETE: 'delete',
		RENAME: 'rename',
		COPY: 'copy',
		CUT: 'cut',
		PASTE: 'paste',
		NEW_FOLDER: 'new-folder',
		SELECT_ALL: 'select-all',
	},

	/** Built-in button identifiers, usable in NavBar and ButtonsBar rows */
	BUTTONS: {
		BACK: 'back',
		FORWARD: 'forward',
		UP: 'up',
		REFRESH: 'refresh',
		DELETE: 'delete',
		RENAME: 'rename',
		COPY: 'copy',
		CUT: 'cut',
		PASTE: 'paste',
		NEW_FOLDER: 'new-folder',
	},

	/** Data ingestion mode — controls how the :data prop is interpreted */
	DATA_MODE: {
		/** Items have an `id` and `parentId`. No nesting. */
		FLAT: 'flat',
		/** Items have an optional `children` array. `id` is still required. */
		HIERARCHICAL: 'hierarchical',
	},

	/**
	 * A sentinel object that renders as a visual divider in menus and button bars.
	 * @example [VOB.BUTTONS.COPY, VOB.SEPARATOR, VOB.BUTTONS.DELETE]
	 */
	SEPARATOR: { type: 'separator' as const },

	/**
	 * Drag-and-drop integration constants (requires vue-pick-n-plop peer dependency).
	 *
	 * KEYS are the pipe-compatible PNP key strings that VueOmniBrowser uses on its
	 * draggables and dropzones.  They are intentionally semantic rather than
	 * filesystem-specific so they compose naturally with the host application's
	 * own PNP usage.
	 *
	 * Container aliases  — "things you can put other things inside"
	 * Leaf aliases        — "individual items you move around"
	 *
	 * Usage examples:
	 *   // Accept any VOB item dropped onto a custom canvas component:
	 *   v-pnp-dropzone="{ keys: VOB.DRAG.KEYS.ITEM }"
	 *
	 *   // Only accept image files from the browser:
	 *   v-pnp-dropzone="{ keys: VOB.DRAG.KEYS.ASSET }"
	 *
	 *   // Drop something from outside into the browser:
	 *   v-pnp-draggable="{ keys: VOB.DRAG.KEYS.EXTERNAL, ctx: myData }"
	 */
	DRAG: {
		KEYS: {
			// ── Container aliases (anything with hasChildren: true) ──────────────
			/** Filesystem folder */
			FOLDER:     'vob:folder',
			/** Generic group or collection */
			GROUP:      'vob:folder',
			/** Media/playlist collection */
			COLLECTION: 'vob:folder',
			/** Product/kanban category */
			CATEGORY:   'vob:folder',
			/** Storage bucket */
			BUCKET:     'vob:folder',

			// ── Leaf aliases (items without children) ─────────────────────────
			/** Filesystem file */
			FILE:   'vob:item',
			/** Generic catch-all leaf */
			ITEM:   'vob:item',
			/** Design/media asset (image, video, font, …) */
			ASSET:  'vob:item',
			/** Kanban / CRM card */
			CARD:   'vob:item',
			/** Graph or tree node */
			NODE:   'vob:item',
			/** Database / log entry */
			ENTRY:  'vob:item',

			// ── Special ────────────────────────────────────────────────────────
			/**
			 * Combined key used on draggables so external drop zones can accept
			 * either containers or leaves with a single key match.
			 * Value: 'vob:item|vob:folder'
			 */
			ANY: 'vob:item|vob:folder',

			/**
			 * Key for things dragged INTO the browser from an external source.
			 * Add this key to your external draggable and provide a VobExternalDropContext
			 * as ctx so the browser can construct a new item from the drop.
			 */
			EXTERNAL: 'vob:external',
		},
	},
} as const;

// ----------------------------------------------------------------
// Derived string-literal types from the const object.
// Useful for typing config properties without importing the full enum.
// ----------------------------------------------------------------

export type VobRowType = (typeof VOB.ROWS)[keyof typeof VOB.ROWS];
export type VobViewMode = (typeof VOB.VIEW_MODES)[keyof typeof VOB.VIEW_MODES];
export type VobAction = (typeof VOB.ACTIONS)[keyof typeof VOB.ACTIONS];
export type VobButtonId = (typeof VOB.BUTTONS)[keyof typeof VOB.BUTTONS];
export type VobDataMode = (typeof VOB.DATA_MODE)[keyof typeof VOB.DATA_MODE];
