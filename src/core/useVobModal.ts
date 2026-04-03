/**
 * @file core/useVobModal.ts
 * @description Built-in confirm/prompt modal state for VueOmniBrowser.
 *
 * Replaces browser-native window.confirm / window.prompt with a themed,
 * non-blocking modal that teleports to <body>. The API mirrors the
 * VobModals interface so it integrates transparently with config.modals.
 *
 * Only one modal can be open at a time. If a second request arrives while
 * one is pending it waits until the first is resolved.
 *
 * Injection key: VOB_MODAL_KEY
 */

import { ref, type Ref } from 'vue';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface ConfirmRequest {
	type: 'confirm';
	message: string;
	resolve: (value: boolean) => void;
}

interface PromptRequest {
	type: 'prompt';
	message: string;
	defaultValue: string;
	resolve: (value: string | null) => void;
}

export type ModalRequest = ConfirmRequest | PromptRequest;

export interface VobModalState {
	/** The currently-pending modal request, or null when none is open. */
	current: Readonly<Ref<ModalRequest | null>>;

	/**
	 * Show a confirm dialog and return a promise that resolves to the user's choice.
	 * True = OK / confirmed, false = Cancel / dismissed.
	 */
	confirm: (message: string) => Promise<boolean>;

	/**
	 * Show a prompt dialog pre-filled with defaultValue.
	 * Resolves to the entered string, or null if the user cancelled.
	 */
	prompt: (message: string, defaultValue?: string) => Promise<string | null>;

	/**
	 * Called by VobModal.vue to resolve the pending request.
	 * @param value - The value to resolve with (boolean for confirm, string|null for prompt).
	 */
	resolveModal: (value: boolean | string | null) => void;
}

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Creates and returns the modal state for a VueOmniBrowser instance.
 */
export function useVobModal(): VobModalState {
	const current = ref<ModalRequest | null>(null);

	/**
	 * Internal queue — avoids dropped requests if two things try to show
	 * a modal simultaneously (e.g. multiple conflicting paste operations).
	 */
	const queue: ModalRequest[] = [];

	function processQueue(): void {
		if (current.value !== null) return;
		const next = queue.shift();
		if (next) current.value = next;
	}

	/**
	 * Called by VobModal.vue after the user clicks OK or Cancel.
	 */
	function resolveModal(value: boolean | string | null): void {
		const req = current.value;
		if (!req) return;

		current.value = null;

		if (req.type === 'confirm') {
			(req as ConfirmRequest).resolve(value as boolean);
		} else {
			(req as PromptRequest).resolve(value as string | null);
		}

		processQueue();
	}

	/**
	 * Show a confirm dialog.
	 */
	function confirm(message: string): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			const req: ConfirmRequest = { type: 'confirm', message, resolve };
			queue.push(req);
			processQueue();
		});
	}

	/**
	 * Show a prompt dialog.
	 */
	function prompt(message: string, defaultValue = ''): Promise<string | null> {
		return new Promise<string | null>((resolve) => {
			const req: PromptRequest = { type: 'prompt', message, defaultValue, resolve };
			queue.push(req);
			processQueue();
		});
	}

	return { current, confirm, prompt, resolveModal };
}
