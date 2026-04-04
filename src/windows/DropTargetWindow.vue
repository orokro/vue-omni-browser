<script setup lang="ts">
/**
 * DropTargetWindow.vue
 * --------------------
 * A bare-metal PNP drop zone that accepts items dragged from any source
 * (VueOmniBrowser instances, TemplatesWindow, or any other v-pnp-draggable)
 * and logs the raw ctx payload to a visible list.
 *
 * Demonstrates how to consume VOB drag events outside of a file browser.
 */

import { ref } from 'vue';
import { vPnpDropzone } from 'vue-pick-n-plop';
import { VOB } from '../constants';

// ----------------------------------------------------------------
// Drop log
// ----------------------------------------------------------------

/** A single recorded drop event. */
interface DropEntry {
	id:     number;
	ts:     string;
	keys:   string;
	ctx:    unknown;
}

const drops = ref<DropEntry[]>([]);
let entryCounter = 0;

/** Whether the dropzone is currently being hovered. */
const isHovering = ref(false);

// ----------------------------------------------------------------
// Drop zone options — accepts anything
// ----------------------------------------------------------------

/**
 * Returns the v-pnp-dropzone binding for the full-area drop target.
 */
const dropzoneOpts = {
	// Accept any VOB key plus external drops.
	keys: `${VOB.DRAG.KEYS.ANY}|${VOB.DRAG.KEYS.EXTERNAL}`,

	/**
	 * Called when a PNP item is hovering over this zone.
	 */
	onHoverStart(): void {
		isHovering.value = true;
	},

	/**
	 * Called when the hover ends without a drop.
	 */
	onHoverEnd(): void {
		isHovering.value = false;
	},

	/**
	 * Records the dropped ctx payload.
	 * @param dragCtx  - The ctx value attached to the draggable.
	 * @param _dropCtx - This zone's own ctx (unused here).
	 */
	onDropped(dragCtx: unknown, _dropCtx: unknown): void {
		isHovering.value = false;
		drops.value.unshift({
			id:   ++entryCounter,
			ts:   new Date().toLocaleTimeString(),
			keys: 'any',
			ctx:  dragCtx,
		});
	},
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/**
 * Formats an unknown ctx payload for display.
 * @param ctx - Raw ctx payload from the PNP event.
 */
function formatCtx(ctx: unknown): string {
	try {
		return JSON.stringify(ctx, null, 2);
	} catch {
		return String(ctx);
	}
}

/**
 * Clears all recorded drop entries.
 */
function clearDrops(): void {
	drops.value = [];
}
</script>

<template>
	<div class="drop-target-window">
		<div class="drop-target-window__toolbar">
			<span class="drop-target-window__label">Drop Target</span>
			<span class="drop-target-window__hint">
				Drop any VOB item or template here
			</span>
			<button
				v-if="drops.length > 0"
				class="drop-target-window__clear"
				@click="clearDrops"
			>
				clear ({{ drops.length }})
			</button>
		</div>

		<!-- Full-area drop zone -->
		<div
			v-pnp-dropzone="dropzoneOpts"
			class="drop-target-window__zone"
			:class="{ 'drop-target-window__zone--hovering': isHovering }"
		>
			<div v-if="drops.length === 0" class="drop-target-window__empty">
				<span class="drop-target-window__empty-icon">⬇</span>
				<span>Drop items here</span>
			</div>

			<div v-else class="drop-target-window__log">
				<div
					v-for="entry in drops"
					:key="entry.id"
					class="drop-target-window__entry"
				>
					<div class="drop-target-window__entry-header">
						<span class="drop-target-window__entry-num">#{{ entry.id }}</span>
						<span class="drop-target-window__entry-ts">{{ entry.ts }}</span>
					</div>
					<pre class="drop-target-window__entry-body">{{ formatCtx(entry.ctx) }}</pre>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
.drop-target-window {
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
		color: #ffb74d;
	}

	&__hint {
		color: #555;
		font-size: 10px;
	}

	&__clear {
		margin-left: auto;
		padding: 2px 8px;
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 3px;
		color: #aaa;
		font-family: monospace;
		font-size: 10px;
		cursor: pointer;

		&:hover {
			background: #333;
			color: #fff;
		}
	}

	&__zone {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		position: relative;
		border: 2px dashed #333;
		border-radius: 0;
		transition: border-color 0.15s, background 0.15s;

		&--hovering {
			border-color: #ffb74d;
			background: rgba(255, 183, 77, 0.05);
		}
	}

	&__empty {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: #444;
		font-family: monospace;
		font-size: 13px;
		pointer-events: none;
	}

	&__empty-icon {
		font-size: 28px;
		opacity: 0.4;
	}

	&__log {
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	&__entry {
		background: #1a1a1a;
		border: 1px solid #2a2a2a;
		border-radius: 4px;
		overflow: hidden;
	}

	&__entry-header {
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 4px 8px;
		background: #222;
		border-bottom: 1px solid #2a2a2a;
		font-family: monospace;
		font-size: 10px;
	}

	&__entry-num {
		color: #ffb74d;
		font-weight: bold;
	}

	&__entry-ts {
		color: #555;
	}

	&__entry-body {
		margin: 0;
		padding: 6px 8px;
		font-family: monospace;
		font-size: 10px;
		color: #9e9e9e;
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 160px;
		overflow-y: auto;
	}
}
</style>
