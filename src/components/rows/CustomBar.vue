<script setup lang="ts">
/**
 * CustomBar.vue
 * A pass-through bar that mounts any user-provided Vue component.
 * The mounted component receives no special props — it can inject
 * from the VOB_* injection keys like any other child component.
 */

import { computed } from 'vue';
import type { VobCustomBarRow } from '../../types';

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------

const props = defineProps<{
	row: VobCustomBarRow;
}>();

// ----------------------------------------------------------------
// Bar height style
// ----------------------------------------------------------------

const barStyle = computed(() =>
	props.row.height ? { height: props.row.height } : {},
);
</script>

<template>
	<div class="vob-bar vob-custom-bar" :style="barStyle">
		<component :is="row.component" />
	</div>
</template>
