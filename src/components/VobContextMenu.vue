<script setup lang="ts">
/**
 * VobContextMenu.vue
 * Teleport-based right-click context menu.
 *
 * Renders resolved entries from VOB_CONTEXT_MENU_KEY at the cursor position.
 * Closes on click-outside, Escape key, or scroll.
 *
 * Applies the parent browser instance's theme so colours stay consistent
 * even though the menu teleports to <body>.
 */

import { onMounted, onUnmounted, inject } from 'vue';
import { VOB_CONTEXT_MENU_KEY, VOB_THEME_KEY } from '../injectionKeys';

// ----------------------------------------------------------------
// Injected state
// ----------------------------------------------------------------

const ctx   = inject(VOB_CONTEXT_MENU_KEY)!;
const theme = inject(VOB_THEME_KEY)!;

// ----------------------------------------------------------------
// Global close handlers
// ----------------------------------------------------------------

function handleGlobalClick(): void {
	if (ctx.isOpen.value) ctx.close();
}

function handleGlobalKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape' && ctx.isOpen.value) {
		event.preventDefault();
		ctx.close();
	}
}

function handleGlobalScroll(): void {
	if (ctx.isOpen.value) ctx.close();
}

onMounted(() => {
	document.addEventListener('mousedown', handleGlobalClick, true);
	document.addEventListener('keydown',   handleGlobalKeydown, true);
	window.addEventListener('scroll',      handleGlobalScroll,  true);
});

onUnmounted(() => {
	document.removeEventListener('mousedown', handleGlobalClick, true);
	document.removeEventListener('keydown',   handleGlobalKeydown, true);
	window.removeEventListener('scroll',      handleGlobalScroll, true);
});
</script>

<template>
	<Teleport to="body">
		<Transition name="vob-ctx-fade">
			<div
				v-if="ctx.isOpen.value"
				class="vob-ctx-menu"
				:class="theme.themeClass.value"
				:style="[theme.overlayStyle.value, { top: ctx.position.value.y + 'px', left: ctx.position.value.x + 'px' }]"
				role="menu"
				@click.stop
			>
				<template v-for="entry in ctx.entries.value" :key="entry.key">
					<!-- Separator -->
					<div v-if="entry.kind === 'separator'" class="vob-ctx-separator" role="separator" />

					<!-- Menu item -->
					<button
						v-else
						class="vob-ctx-item"
						:class="{ 'vob-ctx-item--disabled': entry.disabled }"
						:disabled="entry.disabled"
						role="menuitem"
						@click="entry.action?.()"
					>
						<span v-if="entry.icon" class="material-icons vob-ctx-item__icon">
							{{ entry.icon }}
						</span>
						<span class="vob-ctx-item__label">{{ entry.label }}</span>
					</button>
				</template>
			</div>
		</Transition>
	</Teleport>
</template>

<style scoped>
.vob-ctx-fade-enter-active,
.vob-ctx-fade-leave-active {
	transition: opacity 0.08s ease, transform 0.08s ease;
}

.vob-ctx-fade-enter-from,
.vob-ctx-fade-leave-to {
	opacity: 0;
	transform: scale(0.97);
}
</style>
