<script setup lang="ts">
/**
 * SharedBrowserPanelA.vue
 * -----------------------
 * Thin wrapper for use as a vue-win-mgr window.
 *
 * vue-win-mgr mounts windows without passing props, so shared state is
 * obtained via inject() from the App.vue provide() call.
 */

import { inject } from 'vue';
import SharedBrowserWindow from '../SharedBrowserWindow.vue';
import type { VobDataSpec, VobFlatItemInput, VobItem } from '../../types';

/** Shape of the shared browser context provided by App.vue. */
interface SharedBrowserCtx {
	data:          VobFlatItemInput[];
	dataSpec:      VobDataSpec;
	onDataChanged: (items: VobItem[]) => void;
	/** Shared key so both panels treat each other's drags as same-source moves. */
	dataSourceKey: string;
}

const ctx = inject<SharedBrowserCtx>('sharedBrowserCtx');
</script>

<template>
	<SharedBrowserWindow
		v-if="ctx"
		label="Shared A"
		instance-id="shared-a"
		:data="ctx.data"
		:data-spec="ctx.dataSpec"
		:data-source-key="ctx.dataSourceKey"
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
