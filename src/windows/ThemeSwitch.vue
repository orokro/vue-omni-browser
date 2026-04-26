<script lang="ts">
import type { VobTheme } from '../types';

const THEMES = [
	{ id: 'dark', label: 'Original Dark', value: 'dark' },
	{ id: 'light', label: 'Classic Light', value: 'light' },
	{
		id: 'ocean',
		label: 'Ocean Cyan',
		value: {
			backgroundColor: '#002b36',
			backgroundColorAlt: '#073642',
			surfaceColor: '#073642',
			surfaceColorRaised: '#586e75',
			borderColor: 'rgba(0, 171, 174, 0.3)',
			textColor: '#93a1a1',
			textColorMuted: '#586e75',
			textColorOnAccent: '#ffffff',
			accentColor: '#00ABAE',
			accentColorHover: '#00d1d4',
			selectionColor: 'rgba(0, 171, 174, 0.2)',
			selectionBorderColor: 'rgba(0, 171, 174, 0.6)',
			rowColorEven: '#002b36',
			rowColorOdd: '#073642',
			rowColorHover: '#003642',
			rowColorSelected: 'rgba(0, 171, 174, 0.15)',
			scrollbarTrackColor: '#002b36',
			scrollbarThumbColor: '#586e75',
		} as VobTheme
	}
];
</script>

<script setup lang="ts">
/**
 * ThemeSwitch.vue
 */
import { inject, computed } from 'vue';

interface ThemeCtx {
	state: { current: any };
	setTheme: (theme: any) => void;
}

const themeCtx = inject<ThemeCtx>('themeCtx');

const currentThemeId = computed(() => {
	const val = themeCtx?.state.current;
	if (typeof val === 'string') return val;
	if (val && typeof val === 'object') return 'ocean';
	return 'unknown';
});

const currentThemeLabel = computed(() => {
	return THEMES.find(t => t.id === currentThemeId.value)?.label ?? 'Custom';
});

function resetLayout() {
	localStorage.clear();
	window.location.reload();
}
</script>

<template>
	<div class="theme-switch">
		<div class="theme-switch__list">
			<button
				v-for="t in THEMES"
				:key="t.id"
				class="theme-switch__btn"
				:class="{ 'theme-switch__btn--active': currentThemeId === t.id }"
				@click="themeCtx?.setTheme(t.value)"
			>
				{{ t.label }}
			</button>
		</div>
		<div v-if="themeCtx" class="theme-switch__debug">
			Active: {{ currentThemeLabel }}
		</div>
		<div class="theme-switch__reset">
			<button class="theme-switch__reset-btn" @click="resetLayout">
				Reset Window Layout
			</button>
		</div>
	</div>
</template>

<style scoped lang="scss">
.theme-switch {
	padding: 20px;
	height: 100%;
	background: #1e1e1e;
	color: #ccc;
	font-family: sans-serif;
	display: flex;
	flex-direction: column;

	&__list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	&__btn {
		padding: 12px;
		background: #333;
		border: 1px solid #444;
		color: #fff;
		cursor: pointer;
		border-radius: 4px;
		text-align: left;
		transition: background 0.2s;

		&:hover {
			background: #444;
		}

		&--active {
			border-color: #00ABAE;
			background: rgba(0, 171, 174, 0.1);
			box-shadow: 0 0 10px rgba(0, 171, 174, 0.2);
		}
	}

	&__debug {
		margin-top: 20px;
		font-size: 11px;
		color: #00ABAE;
		font-family: monospace;
		font-weight: bold;
	}

	&__reset {
		margin-top: auto;
		padding-top: 20px;
	}

	&__reset-btn {
		width: 100%;
		padding: 10px;
		background: #444;
		color: #bbb;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;

		&:hover {
			background: #555;
			color: #fff;
		}
	}
}
</style>