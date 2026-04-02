/**
 * @file injectionKeys.ts
 * @description Single source of truth for all Vue injection keys used by VueOmniBrowser.
 *
 * ALL InjectionKey symbols are defined here. No composable or component defines
 * its own — they import from this file. This guarantees that provide() and inject()
 * always operate on the same Symbol reference (reference equality is required).
 *
 * Usage in a child component:
 *   import { VOB_ENGINE_KEY, VOB_NAVIGATION_KEY } from '../../injectionKeys';
 *   const engine = inject(VOB_ENGINE_KEY)!;
 */

import type { InjectionKey, Ref } from 'vue';
import type { VobConfig, VobDataSpec } from './types';
import type { VobEngine } from './core/useVobEngine';
import type { VobNavigation } from './core/useNavigation';
import type { VobSelection } from './core/useSelection';
import type { VobSortFilter } from './core/useSortFilter';
import type { VobViewModeState } from './core/useViewMode';
import type { VobClipboardState } from './core/useClipboard';
import type { VobInlineRenameState } from './core/useInlineRename';

export const VOB_ENGINE_KEY: InjectionKey<VobEngine> = Symbol('vob-engine');
export const VOB_NAVIGATION_KEY: InjectionKey<VobNavigation> = Symbol('vob-navigation');
export const VOB_SELECTION_KEY: InjectionKey<VobSelection> = Symbol('vob-selection');
export const VOB_SORT_FILTER_KEY: InjectionKey<VobSortFilter> = Symbol('vob-sort-filter');
export const VOB_VIEW_MODE_KEY: InjectionKey<VobViewModeState> = Symbol('vob-view-mode');
export const VOB_CLIPBOARD_KEY: InjectionKey<VobClipboardState> = Symbol('vob-clipboard');

/** The resolved config ref, provided by VueOmniBrowser.vue. */
export const VOB_CONFIG_KEY: InjectionKey<Ref<VobConfig>> = Symbol('vob-config');

/** The resolved dataSpec ref, provided by VueOmniBrowser.vue. */
export const VOB_DATA_SPEC_KEY: InjectionKey<Ref<VobDataSpec>> = Symbol('vob-data-spec');

/** The inline rename state, provided by VueOmniBrowser.vue. */
export const VOB_INLINE_RENAME_KEY: InjectionKey<VobInlineRenameState> = Symbol('vob-inline-rename');
