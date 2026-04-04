<script setup lang="ts">
/**
 * TemplatesWindow.vue
 * -------------------
 * Displays a palette of file-type icons that are each v-pnp-draggable
 * with the VOB.DRAG.KEYS.EXTERNAL key.
 *
 * Dropping one of these onto a VueOmniBrowser instance triggers
 * engine.createItem() via the dropzoneOpts external-drop handler,
 * creating a new item in the target folder.
 *
 * The ctx shape matches VobExternalDropContext:
 *   { item: Omit<VobItemInput, 'id'> & { id?: string } }
 */

import { vPnpDraggable } from 'vue-pick-n-plop';
import { VOB } from '../constants';
import type { VobExternalDropContext } from '../types';

// ----------------------------------------------------------------
// Template definitions
// ----------------------------------------------------------------

/** A single template entry shown in the palette. */
interface TemplateEntry {
	/** Human-readable label. */
	label: string;
	/** Material Icons ligature name. */
	icon: string;
	/** The ctx payload sent to the drop target. */
	ctx: VobExternalDropContext;
	/** Accent colour for the icon. */
	color: string;
}

const TEMPLATES: TemplateEntry[] = [
	{
		label: 'New Folder',
		icon:  'folder',
		color: '#ffd54f',
		ctx: {
			item: { type: 'folder', name: 'New Folder', parentId: null },
		},
	},
	{
		label: 'TypeScript',
		icon:  'code',
		color: '#4fc3f7',
		ctx: {
			item: { type: 'file', name: 'script.ts', parentId: null },
		},
	},
	{
		label: 'Image',
		icon:  'image',
		color: '#aed581',
		ctx: {
			item: { type: 'file', name: 'texture.png', parentId: null },
		},
	},
	{
		label: 'Audio',
		icon:  'audio_file',
		color: '#f48fb1',
		ctx: {
			item: { type: 'file', name: 'sound.ogg', parentId: null },
		},
	},
	{
		label: 'JSON',
		icon:  'data_object',
		color: '#80cbc4',
		ctx: {
			item: { type: 'file', name: 'config.json', parentId: null },
		},
	},
	{
		label: 'Shader',
		icon:  'blur_on',
		color: '#ce93d8',
		ctx: {
			item: { type: 'file', name: 'shader.glsl', parentId: null },
		},
	},
	{
		label: 'Scene',
		icon:  'movie',
		color: '#ffcc02',
		ctx: {
			item: { type: 'file', name: 'scene.json', parentId: null },
		},
	},
	{
		label: 'Document',
		icon:  'description',
		color: '#b0bec5',
		ctx: {
			item: { type: 'file', name: 'readme.md', parentId: null },
		},
	},
];

// ----------------------------------------------------------------
// Build draggable options for each template
// ----------------------------------------------------------------

/**
 * Returns the v-pnp-draggable binding for a template entry.
 * @param entry - The template to make draggable.
 */
function draggableOptsFor(entry: TemplateEntry): object {
	return {
		keys:         VOB.DRAG.KEYS.EXTERNAL,
		ctx:          entry.ctx,
		dragItem:     'clone' as const,
		dragThreshold: 5,
	};
}
</script>

<template>
	<div class="templates-window">
		<div class="templates-window__toolbar">
			<span class="templates-window__label">Templates</span>
			<span class="templates-window__hint">Drag into a browser to create items</span>
		</div>

		<div class="templates-window__palette">
			<div
				v-for="entry in TEMPLATES"
				:key="entry.label"
				v-pnp-draggable="draggableOptsFor(entry)"
				class="templates-window__tile"
				:title="`Drag to create: ${entry.label}`"
			>
				<span
					class="material-icons templates-window__tile-icon"
					:style="{ color: entry.color }"
				>{{ entry.icon }}</span>
				<span class="templates-window__tile-label">{{ entry.label }}</span>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
.templates-window {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
	background: #111;

	&__toolbar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 10px;
		background: #1a1a1a;
		border-bottom: 1px solid #333;
		font-family: monospace;
		font-size: 11px;
		color: #888;
	}

	&__label {
		font-weight: bold;
		color: #ce93d8;
	}

	&__hint {
		color: #555;
		font-size: 10px;
	}

	&__palette {
		flex: 1;
		overflow-y: auto;
		padding: 10px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-content: flex-start;
	}

	&__tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		width: 72px;
		height: 72px;
		background: #1a1a1a;
		border: 1px solid #2a2a2a;
		border-radius: 6px;
		cursor: grab;
		user-select: none;
		transition: background 0.12s, border-color 0.12s;

		&:hover {
			background: #252525;
			border-color: #444;
		}

		&:active {
			cursor: grabbing;
		}
	}

	&__tile-icon {
		font-size: 28px;
	}

	&__tile-label {
		font-family: monospace;
		font-size: 9px;
		color: #888;
		text-align: center;
		line-height: 1.2;
	}
}
</style>
