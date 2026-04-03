<script setup lang="ts">
/**
 * VobModal.vue
 * Teleport-based confirm/prompt modal dialog.
 *
 * Teleports to <body> so it layers above everything. Applies the parent
 * browser instance's theme class + CSS vars to the overlay wrapper so
 * the dialog inherits the correct colour scheme even outside .vob-container.
 *
 * Usage: rendered once by VueOmniBrowser.vue. State is driven by VOB_MODAL_KEY.
 */

import { ref, watch, nextTick, inject } from 'vue';
import { VOB_MODAL_KEY, VOB_THEME_KEY } from '../injectionKeys';

// ----------------------------------------------------------------
// Injected state
// ----------------------------------------------------------------

const modal = inject(VOB_MODAL_KEY)!;
const theme = inject(VOB_THEME_KEY)!;

// ----------------------------------------------------------------
// Local prompt input value
// ----------------------------------------------------------------

const inputValue = ref('');
const inputEl    = ref<HTMLInputElement | null>(null);

// When the modal opens, sync the default value and focus the input.
watch(
	() => modal.current.value,
	async (req) => {
		if (!req) return;
		inputValue.value = req.type === 'prompt' ? req.defaultValue : '';
		if (req.type === 'prompt') {
			await nextTick();
			inputEl.value?.select();
		}
	},
	{ immediate: false },
);

// ----------------------------------------------------------------
// Actions
// ----------------------------------------------------------------

function handleOk(): void {
	if (!modal.current.value) return;
	if (modal.current.value.type === 'prompt') {
		modal.resolveModal(inputValue.value);
	} else {
		modal.resolveModal(true);
	}
}

function handleCancel(): void {
	if (!modal.current.value) return;
	if (modal.current.value.type === 'prompt') {
		modal.resolveModal(null);
	} else {
		modal.resolveModal(false);
	}
}

function handleOverlayClick(): void {
	handleCancel();
}

function handleKeydown(event: KeyboardEvent): void {
	if (event.key === 'Enter') {
		event.preventDefault();
		handleOk();
	} else if (event.key === 'Escape') {
		event.preventDefault();
		handleCancel();
	}
}
</script>

<template>
	<Teleport to="body">
		<Transition name="vob-modal-fade">
			<div
				v-if="modal.current.value"
				class="vob-modal-overlay"
				:class="theme.themeClass.value"
				:style="theme.overlayStyle.value"
				role="dialog"
				aria-modal="true"
				:aria-label="modal.current.value.type === 'confirm' ? 'Confirm' : 'Input required'"
				@click.self="handleOverlayClick"
				@keydown="handleKeydown"
			>
				<div class="vob-modal">
					<!-- Message -->
					<p class="vob-modal__message">{{ modal.current.value.message }}</p>

					<!-- Prompt input -->
					<input
						v-if="modal.current.value.type === 'prompt'"
						ref="inputEl"
						v-model="inputValue"
						class="vob-modal__input"
						type="text"
						autofocus
						@keydown="handleKeydown"
					/>

					<!-- Buttons -->
					<div class="vob-modal__actions">
						<button class="vob-modal__btn vob-modal__btn--primary" @click="handleOk">
							OK
						</button>
						<button class="vob-modal__btn" @click="handleCancel">
							Cancel
						</button>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<style scoped>
.vob-modal-fade-enter-active,
.vob-modal-fade-leave-active {
	transition: opacity 0.12s ease;
}

.vob-modal-fade-enter-from,
.vob-modal-fade-leave-to {
	opacity: 0;
}
</style>
