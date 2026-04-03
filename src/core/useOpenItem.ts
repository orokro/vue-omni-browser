/**
 * @file core/useOpenItem.ts
 * @description Shared "open" action for VueOmniBrowser.
 *
 * Centralises the logic triggered whenever a user "opens" an item:
 *   - Double-click on a row
 *   - Enter key with the item selected
 *   - "Open" in the right-click context menu
 *
 * Behaviour:
 *   1. If the item type has `hasChildren: true`, navigate into it and clear
 *      the current selection.
 *   2. If `config.onOpen` is provided, call it with the item and the public API.
 *      This fires for ALL item types, including containers — after navigation.
 *
 * Injection key: none (used directly by composables / view components via inject).
 */

import type { Ref } from 'vue';
import type { VobItem, VobConfig, VobApi } from '../types';
import type { VobEngine } from './useVobEngine';
import type { VobNavigation } from './useNavigation';
import type { VobSelection } from './useSelection';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface VobOpenItemState {
	/**
	 * Execute the "open" action for the given item.
	 * Safe to call during a rename — no-ops in that case.
	 */
	openItem: (item: VobItem) => void;
}

// ----------------------------------------------------------------
// Composable
// ----------------------------------------------------------------

/**
 * Creates the shared open-item handler.
 *
 * @param engine     - Engine instance (type definition lookup).
 * @param navigation - Navigation state (navigateTo).
 * @param selection  - Selection state (clearSelection).
 * @param config     - Reactive config ref (onOpen callback + API accessor).
 * @param getApi     - Lazy getter for the public VobApi (avoids circular dep at init).
 */
export function useOpenItem(
	engine: VobEngine,
	navigation: VobNavigation,
	selection: VobSelection,
	config: Ref<VobConfig>,
	getApi: () => VobApi,
): VobOpenItemState {

	/**
	 * Open an item: navigate if it's a container, then fire config.onOpen.
	 */
	function openItem(item: VobItem): void {
		const def = engine.getTypeDefinition(item.type);

		if (def?.hasChildren) {
			navigation.navigateTo([...navigation.currentPathIds.value, item.id]);
			selection.clearSelection();
		}

		if (config.value.onOpen) {
			config.value.onOpen(item, getApi());
		}
	}

	return { openItem };
}
