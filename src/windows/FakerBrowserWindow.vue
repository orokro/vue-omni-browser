<script setup lang="ts">
/**
 * FakerBrowserWindow.vue
 * ----------------------
 * A standalone VueOmniBrowser demo window that generates its data from a
 * numeric seed using the seeded LCG file tree generator.
 *
 * Changing the seed input regenerates the entire tree deterministically —
 * the same number always produces the same file system.
 */

import { ref, computed, watch } from 'vue';
import { VOB } from '../constants';
import type { VobConfig, VobDataSpec, VobFlatItemInput, VobItem } from '../types';
import VueOmniBrowser from '../components/VueOmniBrowser.vue';
import { generateFileTree } from '../utils/fileTreeGenerator';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

interface Props {
	/** Initial seed value. */
	initialSeed?: number;
	/** Optional instance ID for drag tracking. */
	instanceId?: string;
}

const props = withDefaults(defineProps<Props>(), {
	initialSeed: 42,
	instanceId:  undefined,
});

// ----------------------------------------------------------------
// Seed state
// ----------------------------------------------------------------

/** Current seed string (bound to the input). */
const seedInput = ref(String(props.initialSeed));

/** Parsed integer seed — falls back to 0 for non-numeric input. */
const seedValue = computed<number>(() => {
	const n = parseInt(seedInput.value, 10);
	return isNaN(n) ? 0 : n;
});

// ----------------------------------------------------------------
// DataSpec
// ----------------------------------------------------------------

const dataSpec = ref<VobDataSpec>({
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
// Data — regenerated whenever the seed changes
// ----------------------------------------------------------------

/** Reactive flat item list derived from the current seed. */
const data = ref<VobFlatItemInput[]>(generateFileTree(seedValue.value));

watch(seedValue, (newSeed) => {
	data.value = generateFileTree(newSeed);
}, { immediate: false });

// ----------------------------------------------------------------
// Config
// ----------------------------------------------------------------

const config = ref<VobConfig>({
	multiSelect:         true,
	readOnly:            false,
	showHidden:          false,
	dataMode:            VOB.DATA_MODE.FLAT,
	enableMaterialIcons: true,
	virtualRoot:         'Generated FS',
	rows: [
		{
			type:    VOB.ROWS.NAV_BAR,
			buttons: [
				VOB.BUTTONS.BACK,
				VOB.BUTTONS.FORWARD,
				VOB.BUTTONS.UP,
				VOB.SEPARATOR,
				VOB.BUTTONS.REFRESH,
			],
		},
		{
			type:    VOB.ROWS.BUTTONS_BAR,
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
			type:           VOB.ROWS.STATUS_BAR,
			statusProvider: (ctx) =>
				ctx.selectedItems.length > 0
					? `${ctx.selectedItems.length} item(s) selected`
					: `${ctx.currentItems.length} item(s) — seed ${seedValue.value}`,
		},
	],
});

// ----------------------------------------------------------------
// Data changed handler — keep data ref in sync with engine mutations
// ----------------------------------------------------------------

/**
 * Re-sync the data ref when the browser mutates its internal state
 * (rename, move, delete, etc.) so the round-trip stays consistent.
 * @param items - Updated flat item list.
 */
function handleDataChanged(items: VobItem[]): void {
	data.value = items as VobFlatItemInput[];
}

// ----------------------------------------------------------------
// Seed form handler
// ----------------------------------------------------------------

/**
 * Apply the seed input immediately on Enter key press.
 * @param e - Keyboard event.
 */
function onSeedKeydown(e: KeyboardEvent): void {
	if (e.key === 'Enter') {
		(e.target as HTMLInputElement).blur();
	}
}
</script>

<template>
	<div class="faker-window">
		<div class="faker-window__toolbar">
			<span class="faker-window__label">Generated FS</span>
			<label class="faker-window__seed-label" for="faker-seed-input">seed:</label>
			<input
				id="faker-seed-input"
				v-model="seedInput"
				class="faker-window__seed-input"
				type="number"
				min="0"
				max="999999999"
				step="1"
				@keydown="onSeedKeydown"
			/>
			<span class="faker-window__count">{{ data.length }} items</span>
		</div>

		<div class="faker-window__browser">
			<VueOmniBrowser
				:config="config"
				:data-spec="dataSpec"
				:data="data"
				:instance-id="instanceId"
				theme="dark"
				style="height: 100%;"
				@on-data-changed="handleDataChanged"
			/>
		</div>
	</div>
</template>

<style scoped lang="scss">
.faker-window {
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
		color: #81c784;
		margin-right: 4px;
	}

	&__seed-label {
		color: #aaa;
	}

	&__seed-input {
		width: 90px;
		padding: 2px 6px;
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 3px;
		color: #eee;
		font-family: monospace;
		font-size: 11px;

		&:focus {
			outline: none;
			border-color: #81c784;
		}
	}

	&__count {
		margin-left: auto;
		color: #666;
	}

	&__browser {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
}
</style>
