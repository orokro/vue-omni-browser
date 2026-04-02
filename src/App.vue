<script setup lang="ts">
/**
 * Development sandbox for VueOmniBrowser.
 * This file is for local testing only — not part of the library output.
 *
 * Phase 1: Exercises the core engine, navigation, selection, and sort/filter
 * composables directly to verify they work before any UI is built.
 */

import { ref, watch } from 'vue';
import { VOB } from './constants';
import type { VobConfig, VobDataSpec, VobHierarchicalItemInput } from './types';
import { useVobEngine } from './core/useVobEngine';
import { useNavigation } from './core/useNavigation';
import { useSelection } from './core/useSelection';
import { useSortFilter } from './core/useSortFilter';

// ----------------------------------------------------------------
// Sample data for smoke testing
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
				],
			},
			{
				id: 'folder-audio',
				type: 'folder',
				name: 'Audio',
				createdAt: '2024-01-05',
				children: [
					{ id: 'file-music', type: 'file', name: 'theme.ogg', size: '8MB', createdAt: '2024-01-06' },
				],
			},
		],
	},
	{
		id: 'folder-scenes',
		type: 'folder',
		name: 'Scenes',
		createdAt: '2024-02-01',
		children: [
			{ id: 'file-main', type: 'file', name: 'main.scene', size: '64KB', createdAt: '2024-02-02' },
		],
	},
]);

const config = ref<VobConfig>({
	multiSelect: true,
	readOnly: false,
	showHidden: false,
	dataMode: VOB.DATA_MODE.HIERARCHICAL,
	enableMaterialIcons: false,
});

// ----------------------------------------------------------------
// Wire up the composables
// ----------------------------------------------------------------

const engine = useVobEngine(config, dataSpec, data);
const navigation = useNavigation(engine, config);
const selection = useSelection(engine, config);
const sortFilter = useSortFilter();

// ----------------------------------------------------------------
// Reactive current items — recompute on navigation or registry change
// ----------------------------------------------------------------

const currentItems = ref(sortFilter.applyToItems(
	engine.getChildren(navigation.currentFolderId.value),
	dataSpec.value,
));

function refreshCurrentItems(): void {
	currentItems.value = sortFilter.applyToItems(
		engine.getChildren(navigation.currentFolderId.value),
		dataSpec.value,
	);
}

watch([navigation.currentFolderId, engine.registryVersion, sortFilter.sortKey, sortFilter.sortDirection], () => {
	refreshCurrentItems();
});

function openFolder(id: string): void {
	const newPath = [...navigation.currentPathIds.value, id];
	navigation.navigateTo(newPath);
	selection.clearSelection();
}
</script>

<template>
	<div style="font-family: monospace; padding: 16px; background: #1a1a2e; color: #eee; min-height: 100vh;">
		<h1 style="color: #e94560; margin-top: 0;">VueOmniBrowser — Phase 1 Sandbox</h1>

		<section style="margin-bottom: 12px;">
			<strong>Registry:</strong> {{ engine.registry.value.size }} items &nbsp;|&nbsp;
			<strong>Root IDs:</strong> {{ engine.rootIds.value.join(', ') }} &nbsp;|&nbsp;
			<strong>Registry version:</strong> {{ engine.registryVersion.value }}
		</section>

		<section style="margin-bottom: 12px;">
			<strong>Path:</strong> "{{ navigation.currentPathString.value || '/' }}"
			&nbsp;
			<button :disabled="!navigation.canGoBack.value" @click="navigation.back()">← Back</button>
			<button :disabled="!navigation.canGoForward.value" @click="navigation.forward()">Forward →</button>
			<button :disabled="!navigation.canGoUp.value" @click="navigation.up()">↑ Up</button>
			<button @click="navigation.goToRoot()">⌂ Root</button>
		</section>

		<section style="margin-bottom: 12px;">
			<strong>Current folder contents</strong> (double-click a folder to navigate):
			<ul style="margin: 4px 0; padding-left: 20px;">
				<li
					v-for="item in currentItems"
					:key="item.id"
					:style="{
						cursor: 'pointer',
						color: selection.isSelected(item.id) ? '#e94560' : '#eee',
						padding: '2px 0'
					}"
					@click="selection.handleClick(item.id, $event.ctrlKey ? 'ctrl' : $event.shiftKey ? 'shift' : 'none', currentItems.map(i => i.id))"
					@dblclick="item.type === 'folder' ? openFolder(item.id) : null"
				>
					{{ item.type === 'folder' ? '📁' : '📄' }} {{ item.name }}
				</li>
				<li v-if="currentItems.length === 0" style="color: #666; font-style: italic;">(empty directory)</li>
			</ul>
		</section>

		<section style="margin-bottom: 12px;">
			<strong>Selected:</strong>
			{{ selection.selectedItems.value.map(i => i.name).join(', ') || '(none)' }}
			&nbsp;
			<button @click="selection.clearSelection()">Clear</button>
			&nbsp;
			<button @click="selection.selectAll(currentItems.map(i => i.id))">Select All</button>
		</section>

		<section style="margin-bottom: 12px;">
			<strong>Sort:</strong>
			<button @click="sortFilter.setSortKey('name')">
				Name {{ sortFilter.sortKey.value === 'name' ? (sortFilter.sortDirection.value === 'asc' ? '↑' : '↓') : '' }}
			</button>
			<button @click="sortFilter.setSortKey('size')">
				Size {{ sortFilter.sortKey.value === 'size' ? (sortFilter.sortDirection.value === 'asc' ? '↑' : '↓') : '' }}
			</button>
			<button @click="sortFilter.setSortKey('createdAt')">
				Date {{ sortFilter.sortKey.value === 'createdAt' ? (sortFilter.sortDirection.value === 'asc' ? '↑' : '↓') : '' }}
			</button>
		</section>

		<section>
			<strong>Live data mutation test:</strong>
			&nbsp;
			<button @click="data[0].name = data[0].name === 'Assets' ? 'Assets (renamed)' : 'Assets'">
				Toggle rename root folder
			</button>
			&nbsp;
			<button @click="engine.createItem({ type: 'file', name: 'dynamic-file.txt', parentId: navigation.currentFolderId.value })">
				+ Add file here
			</button>
		</section>
	</div>
</template>
