<script setup lang="ts">
/**
 * SharedBrowserPanelB.vue
 * -----------------------
 * Thin wrapper for use as a vue-win-mgr window (second shared browser instance).
 *
 * Injects the same shared state as SharedBrowserPanelA but identifies itself
 * with instanceId="shared-b" for drag origin tracking.
 */

import { inject } from 'vue';
import SharedBrowserWindow from '../SharedBrowserWindow.vue';
import type { VobDataSpec, VobFlatItemInput, VobItem } from '../../types';

/** Shape of the shared browser context provided by App.vue. */
interface SharedBrowserCtx {
	data:          VobFlatItemInput[];
	dataSpec:      VobDataSpec;
	onDataChanged: (items: VobItem[]) => void;
}

const ctx = inject<SharedBrowserCtx>('sharedBrowserCtx');
</script>

<template>
	<SharedBrowserWindow
		v-if="ctx"
		label="Shared B"
		instance-id="shared-b"
		:data="ctx.data"
		:data-spec="ctx.dataSpec"
		@data-changed="ctx.onDataChanged"
	/>
	<div v-else class="panel-error">No shared context injected.</div>
</template>

<style scoped>
.panel-error {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100%;
	font-family: monospace;
	font-size: 12px;
	color: #e57373;
	background: #1a0000;
}
</style>
