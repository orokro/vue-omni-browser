<script setup lang="ts">
/**
 * App.vue — Multi-window demo (vue-win-mgr tiling layout)
 * --------------------------------------------------------
 * Demonstrates VueOmniBrowser inside a vue-win-mgr docking layout with five
 * content windows arranged in a VS Code-style split view:
 *
 *  ┌────────────────────────────┬────────────┐
 *  │  Shared A  │  Shared B     │ Templates  │
 *  │            (tabbed)        │            │
 *  ├────────────────────────────┼────────────┤
 *  │  Generated FS              │ Drop Target│
 *  └────────────────────────────┴────────────┘
 *
 * Shared A and B share the same reactive data ref; mutations in either
 * panel are immediately reflected in the other.
 *
 * vue-win-mgr windows cannot receive props, so shared state is provided via
 * provide() and injected in the panel wrapper components.
 */

import { ref, provide } from 'vue';
import { WindowManager, FRAME_STYLE } from 'vue-win-mgr';
import type { AvailableWindow, LayoutFrame } from 'vue-win-mgr';
import 'vue-win-mgr/dist/style.css';
import 'material-icons/iconfont/material-icons.css';

import type { VobDataSpec, VobFlatItemInput, VobItem } from './types';

// Window components
import SharedBrowserPanelA from './windows/wm/SharedBrowserPanelA.vue';
import SharedBrowserPanelB from './windows/wm/SharedBrowserPanelB.vue';
import FakerBrowserWindow  from './windows/FakerBrowserWindow.vue';
import DropTargetWindow    from './windows/DropTargetWindow.vue';
import TemplatesWindow     from './windows/TemplatesWindow.vue';

// ----------------------------------------------------------------
// Shared DataSpec
// ----------------------------------------------------------------

const sharedDataSpec = ref<VobDataSpec>({
	types: [
		{
			slug:        'folder',
			label:       'Folder',
			hasChildren: true,
			metaKeys:    ['name', 'createdAt'],
		},
		{
			slug:        'file',
			label:       'File',
			hasChildren: false,
			metaKeys:    ['name', 'size', 'createdAt'],
		},
	],
});

// ----------------------------------------------------------------
// Shared data (shared between panel A and panel B)
// ----------------------------------------------------------------

const sharedData = ref<VobFlatItemInput[]>([
	{ id: 'folder-assets',   type: 'folder', name: 'Assets',         parentId: null,              createdAt: '2024-01-01' },
	{ id: 'folder-textures', type: 'folder', name: 'Textures',       parentId: 'folder-assets',   createdAt: '2024-01-02' },
	{ id: 'folder-audio',    type: 'folder', name: 'Audio',          parentId: 'folder-assets',   createdAt: '2024-01-05' },
	{ id: 'file-hero',       type: 'file',   name: 'hero.png',       parentId: 'folder-textures', size: '512KB',  createdAt: '2024-01-03' },
	{ id: 'file-bg',         type: 'file',   name: 'background.png', parentId: 'folder-textures', size: '2MB',    createdAt: '2024-01-04' },
	{ id: 'file-music',      type: 'file',   name: 'theme.ogg',      parentId: 'folder-audio',    size: '8MB',    createdAt: '2024-01-06' },
	{ id: 'file-sfx',        type: 'file',   name: 'jump.wav',       parentId: 'folder-audio',    size: '24KB',   createdAt: '2024-01-07' },
	{ id: 'file-readme',     type: 'file',   name: 'README.md',      parentId: 'folder-assets',   size: '4KB',    createdAt: '2024-01-08' },
	{ id: 'folder-scenes',   type: 'folder', name: 'Scenes',         parentId: null,              createdAt: '2024-02-01' },
	{ id: 'file-main',       type: 'file',   name: 'main.scene',     parentId: 'folder-scenes',   size: '64KB',   createdAt: '2024-02-02' },
	{ id: 'file-menu',       type: 'file',   name: 'menu.scene',     parentId: 'folder-scenes',   size: '12KB',   createdAt: '2024-02-03' },
	{ id: 'folder-scripts',  type: 'folder', name: 'Scripts',        parentId: null,              createdAt: '2024-03-01' },
	{ id: 'file-player',     type: 'file',   name: 'Player.cs',      parentId: 'folder-scripts',  size: '8KB',    createdAt: '2024-03-02' },
	{ id: 'file-enemy',      type: 'file',   name: 'Enemy.cs',       parentId: 'folder-scripts',  size: '6KB',    createdAt: '2024-03-03' },
]);

/**
 * Keeps sharedData in sync when either panel mutates internal state.
 * @param items - Updated flat item list from the engine.
 */
function handleSharedDataChanged(items: VobItem[]): void {
	sharedData.value = items as VobFlatItemInput[];
}

// ----------------------------------------------------------------
// Provide shared browser context (injected by the panel wrappers)
// ----------------------------------------------------------------

provide('sharedBrowserCtx', {
	get data()          { return sharedData.value; },
	get dataSpec()      { return sharedDataSpec.value; },
	onDataChanged:      handleSharedDataChanged,
	// Both panels get the same key so cross-panel drags are treated as moves.
	dataSourceKey:      'shared-project-fs',
});

// ----------------------------------------------------------------
// Available windows
// ----------------------------------------------------------------

const availableWindows: AvailableWindow[] = [
	{
		window: SharedBrowserPanelA,
		title:  'Shared Browser A',
		slug:   'shared-a',
	},
	{
		window: SharedBrowserPanelB,
		title:  'Shared Browser B',
		slug:   'shared-b',
	},
	{
		window: FakerBrowserWindow,
		title:  'Generated FS',
		slug:   'generated',
	},
	{
		window: DropTargetWindow,
		title:  'Drop Target',
		slug:   'drop-target',
	},
	{
		window: TemplatesWindow,
		title:  'Templates',
		slug:   'templates',
	},
];

// ----------------------------------------------------------------
// Layout  (coordinates in a virtual 1920×1080 space)
//
//  ┌──────────────────────┬──────────┐
//  │  main (A + B tabbed) │ sidebar  │
//  │                      │ (tmpl +  │
//  ├──────────────────────┤  drop)   │
//  │  generated FS        │          │
//  └──────────────────────┴──────────┘
// ----------------------------------------------------------------

const layout: LayoutFrame[] = [
	// Root viewport sentinel
	{
		name:   'window',
		top:    0,
		left:   0,
		bottom: 1080,
		right:  1920,
	},
	// Top-left: the two shared browsers as tabs
	{
		name:    'main',
		windows: ['shared-a', 'shared-b'],
		style:   FRAME_STYLE.TABBED,
		top:     0,
		left:    0,
		right:   ['ref', 'window.right-460'],
		bottom:  ['ref', 'window.bottom-320'],
	},
	// Bottom-left: generated file system browser
	{
		name:    'generated',
		windows: ['generated'],
		style:   FRAME_STYLE.TABBED,
		top:     ['ref', 'main.bottom'],
		left:    0,
		right:   ['ref', 'main.right'],
		bottom:  ['ref', 'window.bottom'],
	},
	// Right column top: templates palette
	{
		name:    'sidebar-top',
		windows: ['templates'],
		style:   FRAME_STYLE.TABBED,
		top:     0,
		left:    ['ref', 'main.right'],
		right:   ['ref', 'window.right'],
		bottom:  ['ref', 'window.top+560'],
	},
	// Right column bottom: drop target
	{
		name:    'sidebar-bottom',
		windows: ['drop-target'],
		style:   FRAME_STYLE.TABBED,
		top:     ['ref', 'sidebar-top.bottom'],
		left:    ['ref', 'main.right'],
		right:   ['ref', 'window.right'],
		bottom:  ['ref', 'window.bottom'],
	},
];
</script>

<template>
	<main class="demo-root" @contextmenu.prevent>
		<WindowManager
			:available-windows="availableWindows"
			:default-layout="layout"
			:show-top-bar="false"
			:show-status-bar="false"
			:split-merge-handles="true"
			:theme="{
				frameTabsActiveColor: 'rgb(105, 105, 105)',
			}"
		/>
	</main>
</template>

<style lang="scss">
/* Global resets for the demo */
* {
	box-sizing: border-box;
}

html,
body {
	margin:  0;
	padding: 0;
	width:   100vw;
	height:  100vh;
	overflow: hidden;
	background: #0d1117;
}
</style>

<style scoped lang="scss">
.demo-root {
	width:  100vw;
	height: 100vh;
	overflow: hidden;
}
</style>
