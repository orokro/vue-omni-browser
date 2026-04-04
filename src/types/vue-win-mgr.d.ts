/**
 * @file types/vue-win-mgr.d.ts
 * @description Ambient declarations for vue-win-mgr.
 *
 * The package ships no bundled TypeScript types. This stub satisfies the
 * compiler so App.vue can import and use the library without errors.
 *
 * Based on the public API observed in the package's README and example code.
 */

declare module 'vue-win-mgr' {
	import type { DefineComponent, Component } from 'vue';

	// ----------------------------------------------------------------
	// Frame style enum
	// ----------------------------------------------------------------

	/** Controls how multiple windows within a single frame are presented. */
	export const FRAME_STYLE: {
		/** Windows stacked as labelled tabs. */
		readonly TABBED: 'tabbed';
		/** Only the first window is shown; no tab bar rendered. */
		readonly SINGLE: 'single';
	};

	// ----------------------------------------------------------------
	// Layout types
	// ----------------------------------------------------------------

	/**
	 * A spatial reference to another frame's edge.
	 * Syntax: ["ref", "<frameName>.<edge>[±offset]"]
	 * @example ["ref", "window.right-400"]
	 * @example ["ref", "mainFrame.bottom"]
	 */
	export type LayoutRef = ['ref', string];

	/** A coordinate in the layout grid — either a pixel number or a ref expression. */
	export type LayoutCoord = number | LayoutRef;

	/**
	 * Defines a single named region in the window manager layout.
	 * The reserved name "window" describes the root viewport.
	 */
	export interface LayoutFrame {
		/** Unique name for this frame — used as target in ["ref", "name.edge"] expressions. */
		name:     string;
		/** Slugs of windows to show in this frame. */
		windows?: string[];
		/** How multiple windows in this frame are presented. */
		style?:   string;
		left?:    LayoutCoord;
		right?:   LayoutCoord;
		top?:     LayoutCoord;
		bottom?:  LayoutCoord;
	}

	// ----------------------------------------------------------------
	// Available window descriptor
	// ----------------------------------------------------------------

	/** Registers a component as a named window available to the window manager. */
	export interface AvailableWindow {
		/** The Vue component to mount as this window's content. */
		window: Component;
		/** Human-readable title shown in the title bar and tab. */
		title:  string;
		/** Unique identifier referenced in layout `windows` arrays. */
		slug:   string;
		/** URL or path to a small icon shown in the tab / title bar. */
		icon?:  string;
	}

	// ----------------------------------------------------------------
	// Context types (accessible via getContext() on the manager ref)
	// ----------------------------------------------------------------

	export interface WindowContext        { [key: string]: unknown; }
	export interface WindowFrameContext   { [key: string]: unknown; }
	export interface WindowManagerContext { [key: string]: unknown; }

	// ----------------------------------------------------------------
	// Theme
	// ----------------------------------------------------------------

	export interface WindowManagerTheme {
		frameTabsActiveColor?: string;
		[key: string]: unknown;
	}

	// ----------------------------------------------------------------
	// WindowManager component
	// ----------------------------------------------------------------

	/**
	 * Root tiling/docking window manager component.
	 *
	 * Slots:
	 *  - default   — misc content inside the manager root
	 *  - statusBar — mounted in the status bar (requires showStatusBar: true)
	 */
	export const WindowManager: DefineComponent<{
		availableWindows?:  AvailableWindow[];
		defaultLayout?:     LayoutFrame[];
		showTopBar?:        boolean;
		showStatusBar?:     boolean;
		topBarComponent?:   Component;
		splitMergeHandles?: boolean;
		theme?:             WindowManagerTheme;
	}>;
}
