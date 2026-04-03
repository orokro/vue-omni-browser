/**
 * @file directives/focusSelect.ts
 * @description Vue directive that focuses and selects all text in an input
 * element immediately after it is inserted into the DOM.
 *
 * Use instead of the native `autofocus` attribute on conditionally rendered
 * (`v-if`) inputs — `autofocus` is only honoured by browsers on the initial
 * page load and is not re-triggered when an element is dynamically mounted.
 *
 * Usage in a `<script setup>` component:
 *   import { vFocusSelect } from '@/directives/focusSelect';
 *   // then in template: <input v-focus-select ... />
 */

import type { Directive } from 'vue';

/**
 * Vue directive: focuses the element and selects all its text on mount.
 *
 * @example
 * ```html
 * <input v-focus-select v-model="renameValue" />
 * ```
 */
export const vFocusSelect: Directive<HTMLInputElement> = {
	mounted(el: HTMLInputElement): void {
		el.focus();
		el.select();
	},
};
