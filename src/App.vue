<script setup lang="ts">
/**
 * Development sandbox for VueOmniBrowser — Phase 2.
 * Uses the real <VueOmniBrowser> component instead of raw composables.
 */

import { ref } from 'vue';
import { VOB } from './constants';
import type { VobConfig, VobDataSpec, VobHierarchicalItemInput, VobApi } from './types';
import VueOmniBrowser from './components/VueOmniBrowser.vue';

// ----------------------------------------------------------------
// Sample data
// ----------------------------------------------------------------

const dataSpec = ref<VobDataSpec>({
	types: [
		{
			slug: 'folder',
			label: 'Folder',
			hasChildren: true,
			metaKeys: ['name', 'createdAt'],
			drag: { key: 'vob-folder' },
			drop: { accepts: ['vob-folder', 'vob-file'] },
		},
		{
			slug: 'file',
			label: 'File',
			hasChildren: false,
			metaKeys: ['name', 'size', 'createdAt'],
			drag: { key: 'vob-file' },
		},
	],
});

const data = ref<VobHierarchicalItemInput[]>([
	{
		id: 'folder-assets',
		type: 'folder',
		name: 'Assets',
		createdAt: '2024-01-01',
		children: [
			{
				id: 'folder-textures',
				type: 'folder',
				name: 'Textures',
				createdAt: '2024-01-02',
				children: [
					{ id: 'file-hero', type: 'file', name: 'hero.png', size: '512KB', createdAt: '2024-01-03' },
					{ id: 'file-bg', type: 'file', name: 'background.png', size: '2MB', createdAt: '2024-01-04' },
					{ id: 'file-ui', type: 'file', name: 'ui-atlas.png', size: '1.2MB', createdAt: '2024-01-05', hidden: true },
				],
			},
			{
				id: 'folder-audio',
				type: 'folder',
				name: 'Audio',
				createdAt: '2024-01-05',
				children: [
					{ id: 'file-music', type: 'file', name: 'theme.ogg', size: '8MB', createdAt: '2024-01-06' },
					{ id: 'file-sfx', type: 'file', name: 'jump.wav', size: '24KB', createdAt: '2024-01-07' },
				],
			},
			{ id: 'file-readme', type: 'file', name: 'README.md', size: '4KB', createdAt: '2024-01-08' },
		],
	},
	{
		id: 'folder-scenes',
		type: 'folder',
		name: 'Scenes',
		createdAt: '2024-02-01',
		children: [
			{ id: 'file-main', type: 'file', name: 'main.scene', size: '64KB', createdAt: '2024-02-02' },
			{ id: 'file-menu', type: 'file', name: 'menu.scene', size: '12KB', createdAt: '2024-02-03' },
		],
	},
	{
		id: 'folder-scripts',
		type: 'folder',
		name: 'Scripts',
		createdAt: '2024-03-01',
		children: [
			{ id: 'file-player', type: 'file', name: 'Player.cs', size: '8KB', createdAt: '2024-03-02' },
			{ id: 'file-enemy', type: 'file', name: 'Enemy.cs', size: '6KB', createdAt: '2024-03-03' },
		],
	},
]);

const config = ref<VobConfig>({
	multiSelect: true,
	readOnly: false,
	showHidden: false,
	dataMode: VOB.DATA_MODE.HIERARCHICAL,
	enableMaterialIcons: true,
	virtualRoot: 'MyProject',
	rows: [
		{
			type: VOB.ROWS.NAV_BAR,
			buttons: [
				VOB.BUTTONS.BACK,
				VOB.BUTTONS.FORWARD,
				VOB.BUTTONS.UP,
				VOB.SEPARATOR,
				VOB.BUTTONS.REFRESH,
			],
		},
		{
			type: VOB.ROWS.BUTTONS_BAR,
			buttons: [
				VOB.BUTTONS.NEW_FOLDER,
				VOB.SEPARATOR,
				VOB.BUTTONS.CUT,
				VOB.BUTTONS.COPY,
				VOB.BUTTONS.PASTE,
				VOB.SEPARATOR,
				VOB.BUTTONS.RENAME,
				VOB.BUTTONS.DELETE,
			],
			viewModeSettings: {
				availableViewModes: [
					VOB.VIEW_MODES.LIST,
					VOB.VIEW_MODES.DETAILS,
					VOB.VIEW_MODES.ICONS,
					VOB.VIEW_MODES.TREE,
					VOB.VIEW_MODES.COLUMNS,
				],
				defaultViewMode: VOB.VIEW_MODES.DETAILS,
			},
		},
		{ type: VOB.ROWS.CONTENT },
		{
			type: VOB.ROWS.STATUS_BAR,
			statusProvider: (ctx) =>
				ctx.selectedItems.length > 0
					? `${ctx.selectedItems.length} item(s) selected`
					: `${ctx.currentItems.length} item(s) in folder`,
		},
	],
});

// ----------------------------------------------------------------
// Programmatic API access via template ref
// ----------------------------------------------------------------

const browserRef = ref<VobApi | null>(null);
</script>

<template>
	<div style="
		width: 90vw;
		height: 90vh;
		display: flex;
		flex-direction: column;
		background: #111;
		padding: 0;
		margin: 0;
		overflow: hidden;
	">
		<!-- Toolbar for sandbox controls -->
		<div style="
			display: flex;
			gap: 8px;
			align-items: center;
			padding: 6px 12px;
			background: #1a1a1a;
			border-bottom: 1px solid #333;
			font-family: monospace;
			font-size: 12px;
			color: #aaa;
			flex-shrink: 0;
		">
			<strong style="color: #e94560;">VueOmniBrowser</strong>
			<span>Phase 2 Sandbox</span>
			<button
				style="margin-left: auto; padding: 2px 8px; font-size: 11px; cursor: pointer;"
				@click="config.showHidden = !config.showHidden"
			>
				{{ config.showHidden ? 'Hide' : 'Show' }} hidden
			</button>
			<button
				style="padding: 2px 8px; font-size: 11px; cursor: pointer;"
				@click="config.readOnly = !config.readOnly"
			>
				{{ config.readOnly ? 'Disable' : 'Enable' }} read-only
			</button>
			<button
				style="padding: 2px 8px; font-size: 11px; cursor: pointer;"
				@click="browserRef?.navigateTo('folder-textures')"
			>
				API: Go to Textures
			</button>
		</div>

		<!-- The actual component — takes up all remaining space -->
		<div style="flex: 1; min-height: 0; overflow: hidden;">
			<VueOmniBrowser
				ref="browserRef"
				:config="config"
				:data-spec="dataSpec"
				:data="data"
				theme="dark"
				style="height: 100%;"
				@navigate="(ids, path) => console.log('[navigate]', path)"
				@on-data-changed="(items) => console.log('[dataChanged]', items.length, 'items')"
			/>
		</div>
	</div>
</template>
