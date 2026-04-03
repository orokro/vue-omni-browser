<script setup lang="ts">
/**
 * VobButton.vue
 * Renders a single entry from a buttons or menu array.
 *
 * Accepts any VobMenuEntry shape:
 *  - string (VOB.BUTTONS.*) → built-in button with injected state/action
 *  - VobItemSpec            → custom spec-defined button
 *  - VobSeparator           → visual divider bar
 *  - Component              → mounted as-is
 *
 * Built-in button disabled states are derived from injected composable state,
 * so this component is self-contained and correct in any row context.
 */

import { computed, inject, type Component } from 'vue';
import type { VobItemSpec, VobSeparator, VobMenuEntry, VobActionContext } from '../../types';
import { VOB } from '../../constants';
import {
	VOB_ENGINE_KEY,
	VOB_NAVIGATION_KEY,
	VOB_SELECTION_KEY,
	VOB_CLIPBOARD_KEY,
	VOB_CONFIG_KEY,
	VOB_VIEW_MODE_KEY,
	VOB_MODAL_KEY,
} from '../../injectionKeys';
import VobIcon from './VobIcon.vue';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

const props = defineProps<{
	entry: VobMenuEntry;
	/** When true, renders as a compact icon-only button (no label). */
	compact?: boolean;
}>();

// ----------------------------------------------------------------
// Injected state (may be undefined if rendered outside VueOmniBrowser)
// ----------------------------------------------------------------

const engine = inject(VOB_ENGINE_KEY);
const navigation = inject(VOB_NAVIGATION_KEY);
const selection = inject(VOB_SELECTION_KEY);
const clipboard = inject(VOB_CLIPBOARD_KEY);
const config = inject(VOB_CONFIG_KEY);
const viewMode = inject(VOB_VIEW_MODE_KEY);
const modal = inject(VOB_MODAL_KEY);

// ----------------------------------------------------------------
// Entry type discrimination
// ----------------------------------------------------------------

type EntryKind = 'builtin' | 'spec' | 'separator' | 'component';

const entryKind = computed<EntryKind>(() => {
	const e = props.entry;
	if (typeof e === 'string') return 'builtin';
	if (e && typeof e === 'object' && !Array.isArray(e)) {
		if ('type' in e && (e as VobSeparator).type === 'separator') return 'separator';
		if ('name' in e || 'onClick' in e || 'icon' in e || 'toolTipText' in e) return 'spec';
	}
	return 'component';
});

const entryAsSpec = computed<VobItemSpec>(() => props.entry as VobItemSpec);
const entryAsComponent = computed<Component>(() => props.entry as Component);

// ----------------------------------------------------------------
// Built-in button definitions
// ----------------------------------------------------------------

interface BuiltinDef {
	icon: string;
	label: string;
	disabled: boolean;
	/** May be async (e.g. delete confirms via modal before proceeding). */
	action: () => void | Promise<void>;
}

/** Returns a context object for custom action callbacks. */
function makeActionContext(): VobActionContext {
	return {
		selectedItems: selection?.selectedItems.value ?? [],
		currentFolderId: navigation?.currentFolderId.value ?? null,
		currentPathIds: navigation?.currentPathIds.value ?? [],
		navigateTo: (ids) => navigation?.navigateTo(ids),
		refresh: () => engine?.refresh(),
	};
}

const readOnly = computed(() => config?.value.readOnly ?? false);
const hasSelection = computed(() => (selection?.selectedIds.value.size ?? 0) > 0);
const singleSelected = computed(() => selection?.selectedIds.value.size === 1);
const inColumnView = computed(() => viewMode?.isColumnView.value ?? false);

const builtinDef = computed<BuiltinDef | null>(() => {
	if (entryKind.value !== 'builtin') return null;
	const id = props.entry as string;

	switch (id) {
		case VOB.BUTTONS.BACK:
			return {
				icon: 'arrow_back',
				label: 'Back',
				disabled: !(navigation?.canGoBack.value) || inColumnView.value,
				action: () => navigation?.back(),
			};
		case VOB.BUTTONS.FORWARD:
			return {
				icon: 'arrow_forward',
				label: 'Forward',
				disabled: !(navigation?.canGoForward.value) || inColumnView.value,
				action: () => navigation?.forward(),
			};
		case VOB.BUTTONS.UP:
			return {
				icon: 'arrow_upward',
				label: 'Up',
				disabled: !(navigation?.canGoUp.value) || inColumnView.value,
				action: () => navigation?.up(),
			};
		case VOB.BUTTONS.REFRESH:
			return {
				icon: 'refresh',
				label: 'Refresh',
				disabled: false,
				action: () => engine?.refresh(),
			};
		case VOB.BUTTONS.DELETE: {
				const ids = [...(selection?.selectedIds.value ?? [])];
				const count = ids.length;
				const label = count === 1 ? '1 item' : `${count} items`;
				return {
					icon: 'delete',
					label: 'Delete',
					disabled: !hasSelection.value || readOnly.value,
					action: async () => {
						const confirmed = await modal?.confirm(`Delete ${label}?`);
						if (!confirmed) return;
						engine?.deleteItems(ids);
						selection?.clearSelection();
					},
				};
			}
		case VOB.BUTTONS.RENAME:
			return {
				icon: 'edit',
				label: 'Rename',
				// Rename only makes sense for exactly one item.
				disabled: !singleSelected.value || readOnly.value,
				action: () => {
					// Rename trigger — the content view listens for this event.
					// Dispatched as a custom DOM event so the active item row can respond.
					document.dispatchEvent(
						new CustomEvent('vob:rename-selected', {
							detail: { id: [...(selection?.selectedIds.value ?? [])][0] },
						}),
					);
				},
			};
		case VOB.BUTTONS.COPY:
			return {
				icon: 'content_copy',
				label: 'Copy',
				disabled: !hasSelection.value || readOnly.value,
				action: () => clipboard?.copy([...(selection?.selectedIds.value ?? [])]),
			};
		case VOB.BUTTONS.CUT:
			return {
				icon: 'content_cut',
				label: 'Cut',
				disabled: !hasSelection.value || readOnly.value,
				action: () => clipboard?.cut([...(selection?.selectedIds.value ?? [])]),
			};
		case VOB.BUTTONS.PASTE:
			return {
				icon: 'content_paste',
				label: 'Paste',
				disabled: !(clipboard?.hasClipboard.value) || readOnly.value,
				action: () => {
					const targetId = navigation?.currentFolderId.value ?? null;
					clipboard?.paste(targetId);
				},
			};
		case VOB.BUTTONS.NEW_FOLDER:
			return {
				icon: 'create_new_folder',
				label: 'New Folder',
				disabled: readOnly.value,
				action: () => {
					const parentId = navigation?.currentFolderId.value ?? null;
					const id = engine?.createItem({ type: 'folder', name: 'New Folder', parentId });
					if (id) {
						// Immediately begin inline rename so the user can type the real name.
						setTimeout(() => {
							document.dispatchEvent(
								new CustomEvent('vob:rename-selected', { detail: { id } }),
							);
						}, 0);
					}
				},
			};
		default:
			return null;
	}
});

// ----------------------------------------------------------------
// Resolved presentation values (used for both builtin and spec)
// ----------------------------------------------------------------

const resolvedLabel = computed(() =>
	entryKind.value === 'builtin' ? (builtinDef.value?.label ?? '') : (entryAsSpec.value.name ?? ''),
);

const resolvedIcon = computed(() =>
	entryKind.value === 'builtin'
		? (builtinDef.value?.icon)
		: entryAsSpec.value.icon,
);

const resolvedDisabled = computed(() =>
	entryKind.value === 'builtin'
		? (builtinDef.value?.disabled ?? false)
		: (entryAsSpec.value.disabled ?? false),
);

const resolvedTooltip = computed(() =>
	entryKind.value === 'builtin'
		? resolvedLabel.value
		: (entryAsSpec.value.toolTipText ?? entryAsSpec.value.name ?? ''),
);

function handleClick(): void {
	if (resolvedDisabled.value) return;
	if (entryKind.value === 'builtin') {
		builtinDef.value?.action();
	} else if (entryKind.value === 'spec') {
		entryAsSpec.value.onClick?.(makeActionContext());
	}
}
</script>

<template>
	<!-- Separator -->
	<div v-if="entryKind === 'separator'" class="vob-btn-separator" role="separator" />

	<!-- Raw component -->
	<component :is="entryAsComponent" v-else-if="entryKind === 'component'" />

	<!-- Spec component override -->
	<component
		:is="entryAsSpec.component"
		v-else-if="entryKind === 'spec' && entryAsSpec.component"
	/>

	<!-- Button (builtin or spec) -->
	<button
		v-else
		class="vob-btn"
		:class="{ 'vob-btn--compact': compact, 'vob-btn--disabled': resolvedDisabled }"
		:disabled="resolvedDisabled"
		:title="resolvedTooltip"
		:aria-label="resolvedLabel"
		type="button"
		@click="handleClick"
	>
		<VobIcon v-if="resolvedIcon" :icon="resolvedIcon" />
		<span v-if="!compact && resolvedLabel" class="vob-btn__label">{{ resolvedLabel }}</span>
	</button>
</template>

<style scoped>
.vob-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 0 8px;
	height: 100%;
	min-width: 28px;
	background: transparent;
	border: none;
	border-radius: 4px;
	color: var(--vob-text, #eee);
	font-size: var(--vob-font-size, 13px);
	font-family: var(--vob-font-family, inherit);
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.1s;
}

.vob-btn:hover:not(.vob-btn--disabled) {
	background: var(--vob-btn-hover-bg, rgba(255, 255, 255, 0.1));
}

.vob-btn:active:not(.vob-btn--disabled) {
	background: var(--vob-btn-active-bg, rgba(255, 255, 255, 0.18));
}

.vob-btn--disabled {
	opacity: 0.35;
	cursor: not-allowed;
}

.vob-btn__label {
	line-height: 1;
}

.vob-btn-separator {
	width: 1px;
	height: 60%;
	background: var(--vob-border, rgba(255, 255, 255, 0.15));
	margin: 0 4px;
	flex-shrink: 0;
	align-self: center;
}
</style>
