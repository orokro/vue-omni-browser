<script setup lang="ts">
/**
 * VobIcon.vue
 * Renders an icon from one of three sources:
 *  - Material Icons ligature (string, no slash/dot/http prefix)
 *  - Image URL (string starting with '/', './', '../', or 'http')
 *  - Vue component (Component)
 *
 * The `enableMaterialIcons` config flag must be true for ligature rendering.
 * If it's false and a string slug is provided, the icon is silently omitted.
 */

import { computed, inject } from 'vue';
import type { Component } from 'vue';
import type { VobIconSpec } from '../../types';
import { VOB_CONFIG_KEY } from '../../injectionKeys';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

const props = withDefaults(defineProps<{
	icon?: VobIconSpec;
	/** Font size override (falls back to --vob-icon-size CSS variable). */
	size?: string;
}>(), {
	icon: undefined,
	size: undefined,
});

// ----------------------------------------------------------------
// Injected context
// ----------------------------------------------------------------

const config = inject(VOB_CONFIG_KEY);

// ----------------------------------------------------------------
// Resolved icon type
// ----------------------------------------------------------------

const URL_PREFIXES = ['http://', 'https://', '/', './', '../'];

/**
 * Returns the resolved icon type:
 * - 'material' → render as <span class="material-icons">
 * - 'url'      → render as <img src="...">
 * - 'component'→ render as <component :is="...">
 * - 'none'     → render nothing
 */
const iconType = computed<'material' | 'url' | 'component' | 'none'>(() => {
	const icon = props.icon;
	if (!icon) return 'none';

	if (typeof icon === 'string') {
		if (URL_PREFIXES.some((prefix) => (icon as string).startsWith(prefix))) {
			return 'url';
		}
		// Material icon slug — only render if the font is enabled.
		if (config?.value.enableMaterialIcons) return 'material';
		return 'none';
	}

	return 'component';
});

const iconString = computed<string>(() =>
	typeof props.icon === 'string' ? props.icon : '',
);

const iconComponent = computed<Component | null>(() =>
	typeof props.icon !== 'string' && props.icon ? (props.icon as Component) : null,
);

const sizeStyle = computed(() =>
	props.size ? { fontSize: props.size, width: props.size, height: props.size } : {},
);
</script>

<template>
	<span class="vob-icon" :style="sizeStyle">
		<span
			v-if="iconType === 'material'"
			class="material-icons"
		>{{ iconString }}</span>

		<img
			v-else-if="iconType === 'url'"
			:src="iconString"
			class="vob-icon__img"
			alt=""
			aria-hidden="true"
		/>

		<component
			:is="iconComponent"
			v-else-if="iconType === 'component' && iconComponent"
		/>
	</span>
</template>

<style scoped>
.vob-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: var(--vob-icon-size, 18px);
	line-height: 1;
	flex-shrink: 0;
}

.vob-icon__img {
	width: 1em;
	height: 1em;
	object-fit: contain;
}
</style>
