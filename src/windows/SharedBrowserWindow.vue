<script setup lang="ts">
/**
 * SharedBrowserWindow.vue
 * -----------------------
 * A VueOmniBrowser instance that accepts its data from the parent via props
 * and emits updates back up so multiple instances can share the same dataset.
 *
 * Usage in a multi-window demo: mount two of these pointing to the same
 * reactive `data` ref and connect `@on-data-changed` to keep them in sync.
 */

import { ref } from 'vue';
import { VOB } from '../constants';
import type { VobConfig, VobDataSpec, VobFlatItemInput, VobItem } from '../types';
import VueOmniBrowser from '../components/VueOmniBrowser.vue';

// ----------------------------------------------------------------
// Props / emits
// ----------------------------------------------------------------

interface Props {
	/** Flat item list provided (and owned) by the parent. */
	data: VobFlatItemInput[];
	/** DataSpec shared across all browser instances. */
	dataSpec: VobDataSpec;
	/** Optional label shown in the toolbar. */
	label?: string;
	/** Instance ID forwarded to VueOmniBrowser for drag origin tracking. */
	instanceId?: string;
}

withDefaults(defineProps<Props>(), {
	label:      'Shared Browser',
	instanceId: undefined,
});

const emit = defineEmits<{
	/** Emitted whenever the browser mutates internal state. */
	(e: 'dataChanged', items: VobItem[]): void;
}>();

// ----------------------------------------------------------------
// Config
// ----------------------------------------------------------------

const config = ref<VobConfig>({
	multiSelect:         true,
	readOnly:            false,
	showHidden:          false,
	dataMode:            VOB.DATA_MODE.FLAT,
	enableMaterialIcons: true,
	virtualRoot:         'Project',
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
					: `${ctx.currentItems.length} item(s)`,
		},
	],
});

// ----------------------------------------------------------------
// Handlers
// ----------------------------------------------------------------

/**
 * Forward the mutated item list to the parent so shared state stays in sync.
 * @param items - Updated flat item list from the browser engine.
 */
function handleDataChanged(items: VobItem[]): void {
	emit('dataChanged', items);
}
</script>

<template>
	<div class="shared-browser-window">
		<div class="shared-browser-window__toolbar">
			<span class="shared-browser-window__label">{{ label }}</span>
		</div>
		<div class="shared-browser-window__browser">
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
.shared-browser-window {
	display: flex;
	flex-direction: column;
	height: 100%;
	overflow: hidden;
	background: #111;

	&__toolbar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		padding: 4px 10px;
		background: #1a1a1a;
		border-bottom: 1px solid #333;
		font-family: monospace;
		font-size: 11px;
		color: #888;
	}

	&__label {
		font-weight: bold;
		color: #4fc3f7;
	}

	&__browser {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
}
</style>
