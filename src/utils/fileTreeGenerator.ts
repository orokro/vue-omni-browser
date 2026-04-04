/**
 * @file utils/fileTreeGenerator.ts
 * @description Seeded pseudo-random file tree generator.
 *
 * Uses a 32-bit LCG (Linear Congruential Generator) so that the same numeric
 * seed always produces an identical tree — no external dependencies required.
 *
 * The generated data is suitable for use as VobFlatItemInput[].
 */

import type { VobFlatItemInput } from '../types';

// ----------------------------------------------------------------
// LCG implementation (Numerical Recipes parameters)
// ----------------------------------------------------------------

/**
 * Returns a factory that produces floats in [0, 1) for the given seed.
 * @param seed - Integer seed value.
 */
function makeLcg(seed: number): () => number {
	// Mask to 32 bits so the state never exceeds Number.MAX_SAFE_INTEGER.
	let state = seed >>> 0;

	return function rand(): number {
		// Multiplier / increment from "Numerical Recipes" LCG.
		state = ((state * 1664525 + 1013904223) >>> 0);
		return state / 0x100000000; // divide by 2^32
	};
}

// ----------------------------------------------------------------
// Name pools
// ----------------------------------------------------------------

const FOLDER_NAMES = [
	'Assets', 'Audio', 'Animations', 'Builds', 'Cache', 'Config',
	'Data', 'Docs', 'Effects', 'Fonts', 'Icons', 'Images', 'Levels',
	'Lib', 'Locale', 'Logs', 'Maps', 'Materials', 'Media', 'Meshes',
	'Models', 'Music', 'Output', 'Plugins', 'Prefabs', 'Resources',
	'Scenes', 'Scripts', 'Shaders', 'Sounds', 'Sprites', 'Src',
	'Temp', 'Tests', 'Textures', 'Themes', 'Tools', 'UI', 'Utils', 'Video',
];

const FILE_PREFIXES = [
	'Main', 'App', 'Core', 'Base', 'Common', 'Default', 'Index',
	'Player', 'Enemy', 'Camera', 'World', 'Level', 'Stage', 'Scene',
	'Config', 'Settings', 'Utils', 'Helper', 'Manager', 'Controller',
	'Service', 'Store', 'Model', 'View', 'Component', 'Shader',
	'Texture', 'Sprite', 'Mesh', 'Sound', 'Music', 'Track', 'Clip',
	'Anim', 'Layout', 'Theme', 'Font', 'Icon', 'Logo', 'Banner',
];

const FILE_EXTENSIONS: Record<string, string[]> = {
	code:   ['.ts', '.js', '.cs', '.py', '.glsl', '.hlsl', '.wgsl'],
	image:  ['.png', '.jpg', '.webp', '.svg', '.psd', '.tga'],
	audio:  ['.ogg', '.wav', '.mp3', '.flac'],
	data:   ['.json', '.yaml', '.toml', '.xml', '.csv'],
	scene:  ['.scene', '.prefab', '.asset'],
	other:  ['.md', '.txt', '.log', '.bin'],
};

const EXT_CATEGORIES = Object.keys(FILE_EXTENSIONS) as (keyof typeof FILE_EXTENSIONS)[];

const FILE_SIZES = [
	'1 KB', '2 KB', '4 KB', '8 KB', '12 KB', '24 KB', '48 KB',
	'64 KB', '128 KB', '256 KB', '512 KB', '1 MB', '2 MB', '4 MB',
	'8 MB', '16 MB', '32 MB',
];

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------

/**
 * Picks a random element from an array using the LCG.
 * @param arr   - Source array.
 * @param rand  - LCG function.
 */
function pick<T>(arr: T[], rand: () => number): T {
	return arr[Math.floor(rand() * arr.length)];
}

/**
 * Generates a unique folder name for a set of already-used names.
 */
function uniqueFolderName(
	used: Set<string>,
	rand: () => number,
): string {
	let attempt = pick(FOLDER_NAMES, rand);
	let suffix = 0;
	while (used.has(attempt)) {
		suffix++;
		attempt = `${pick(FOLDER_NAMES, rand)}${suffix > 1 ? suffix : ''}`;
	}
	used.add(attempt);
	return attempt;
}

/**
 * Generates a unique file name for a set of already-used names.
 */
function uniqueFileName(
	used: Set<string>,
	rand: () => number,
): string {
	const prefix = pick(FILE_PREFIXES, rand);
	const cat    = pick(EXT_CATEGORIES, rand);
	const ext    = pick(FILE_EXTENSIONS[cat], rand);
	let name = `${prefix}${ext}`;
	let suffix = 0;
	while (used.has(name)) {
		suffix++;
		name = `${prefix}${suffix}${ext}`;
	}
	used.add(name);
	return name;
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

export interface FileTreeGeneratorOptions {
	/** Total approx number of items to generate (default: 200). */
	totalItems?: number;
	/** Maximum folder nesting depth (default: 4). */
	maxDepth?: number;
	/** Probability [0–1] that any given item is a folder (default: 0.25). */
	folderRatio?: number;
}

/**
 * Generates a flat array of VobFlatItemInput items from a numeric seed.
 *
 * The same seed always produces the same tree, making demos reproducible.
 *
 * @param seed    - Integer seed value.
 * @param options - Optional generator tuning.
 * @returns       Flat array ready to pass as the :data prop in FLAT mode.
 */
export function generateFileTree(
	seed: number,
	options: FileTreeGeneratorOptions = {},
): VobFlatItemInput[] {
	const {
		totalItems  = 200,
		maxDepth    = 4,
		folderRatio = 0.25,
	} = options;

	const rand = makeLcg(seed);
	const items: VobFlatItemInput[] = [];

	// idCounter is separate from items.length so IDs stay stable even if we
	// add filtering logic later.
	let idCounter = 0;

	/** All folder IDs created so far (including root sentinels). */
	const folderIds: string[] = [null as unknown as string]; // null = root

	/** Map of folderId → depth (root = 0). */
	const depthMap: Map<string | null, number> = new Map([[null, 0]]);

	/** Names used per parent to avoid siblings with identical names. */
	const siblingNames: Map<string | null, Set<string>> = new Map();

	/**
	 * Returns the names-set for a given parent, creating it if needed.
	 */
	function siblingSet(parentId: string | null): Set<string> {
		if (!siblingNames.has(parentId)) {
			siblingNames.set(parentId, new Set());
		}
		return siblingNames.get(parentId)!;
	}

	for (let i = 0; i < totalItems; i++) {
		// Pick a random parent folder from what we have so far.
		const parentId: string | null = folderIds[Math.floor(rand() * folderIds.length)] ?? null;
		const parentDepth = depthMap.get(parentId) ?? 0;

		// Decide whether to create a folder or a file.
		const isFolder = parentDepth < maxDepth && rand() < folderRatio;

		const id = `gen-${++idCounter}`;
		const used = siblingSet(parentId);

		if (isFolder) {
			const name = uniqueFolderName(used, rand);
			items.push({
				id,
				type:     'folder',
				name,
				parentId,
				createdAt: `2024-${String(Math.floor(rand() * 12) + 1).padStart(2, '0')}-${String(Math.floor(rand() * 28) + 1).padStart(2, '0')}`,
			});
			folderIds.push(id);
			depthMap.set(id, parentDepth + 1);
		} else {
			const name = uniqueFileName(used, rand);
			items.push({
				id,
				type:     'file',
				name,
				parentId,
				size:      pick(FILE_SIZES, rand),
				createdAt: `2024-${String(Math.floor(rand() * 12) + 1).padStart(2, '0')}-${String(Math.floor(rand() * 28) + 1).padStart(2, '0')}`,
			});
		}
	}

	return items;
}
