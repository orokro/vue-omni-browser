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
