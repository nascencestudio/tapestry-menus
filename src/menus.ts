/**
 * Menus (ADR 0001): named trees of links, edited in the dashboard and rendered by `<Menu>` and
 * `<Breadcrumbs>`. Links use Tapestry's link values (a page by id, which follows renames and hides
 * unpublished pages from visitors, or a web address). Everything read or received is validated
 * again; unknown keys are dropped. Pure.
 */
import { cleanLinkValue, type LinkValue } from '@nascencestudio/tapestry/links';

export const MENU_ID = /^mn_[a-z0-9]{16}$/;
export const ITEM_ID = /^mi_[a-z0-9]{12}$/;
export const LIMITS = { name: 80, label: 100, description: 200, className: 100, depth: 6, items: 300 } as const;
const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
/** Extra classes: space-separated CSS identifiers. */
const CLASS_TOKEN = /^-?[_a-zA-Z][_a-zA-Z0-9-]{0,49}$/;

export type Visibility = 'everyone' | 'logged-in' | 'logged-out';

export interface MenuItem {
	id: string;
	label: string;
	/** The label in other languages (`fr` → "À propos"); the page's language picks one. */
	labels?: Record<string, string>;
	/** Where it goes: a page (by id) or a web address; `newTab` opens it in a new window. Null: a label only. */
	link: LinkValue | null;
	/** Shown as the link's title (tooltip). */
	description?: string;
	/** Extra CSS classes (besides the one from the label). */
	className?: string;
	visibility?: Exclude<Visibility, 'everyone'>;
	/** False: kept in the menu but not shown. */
	enabled?: false;
	children?: MenuItem[];
}

export interface Menu {
	id: string;
	name: string;
	items: MenuItem[];
}

/** A new id: prefix + `length` lowercase base-36 characters from `random` (crypto in practice). */
export function newId(prefix: 'mn_' | 'mi_', random: (n: number) => Uint8Array): string {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
	return prefix + [...random(prefix === 'mn_' ? 16 : 12)].map((b) => alphabet[b % 36]).join('');
}

/** One line of text: control characters become spaces, whitespace collapsed, trimmed, capped. */
export function oneLine(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	let text = '';
	for (const char of value) text += (char.codePointAt(0) ?? 0) < 0x20 || char === '\u007f' ? ' ' : char;
	return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * A CSS-safe class name part from a label (ADR 0001): `Main navigation` → `main-navigation`,
 * `À propos` → `a-propos`; never empty (`item`).
 */
export function classSlug(label: string, fallback = 'item'): string {
	const slug = label
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 50)
		.replace(/-+$/, '');
	return slug ? (/^[0-9]/.test(slug) ? `n${slug}` : slug) : fallback;
}

/** A menu's class: `menu menu--main-navigation`. */
export const menuClasses = (menu: Pick<Menu, 'name'>) => ['menu', `menu--${classSlug(menu.name, 'menu')}`];

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function cleanClassName(value: unknown): string | undefined {
	const tokens = oneLine(value, LIMITS.className)
		.split(' ')
		.filter((t) => CLASS_TOKEN.test(t));
	return tokens.length ? [...new Set(tokens)].join(' ') : undefined;
}

function cleanLabels(value: unknown): Record<string, string> | undefined {
	if (!isObject(value)) return undefined;
	const labels: Record<string, string> = {};
	for (const [lang, text] of Object.entries(value)) {
		const label = oneLine(text, LIMITS.label);
		if (LANG.test(lang) && label) labels[lang] = label;
	}
	return Object.keys(labels).length ? labels : undefined;
}

/** Stored or received menu (any JSON) → a valid menu, or null when it can't be used. */
export function parseMenu(raw: unknown): Menu | null {
	if (!isObject(raw) || typeof raw.id !== 'string' || !MENU_ID.test(raw.id)) return null;
	const name = oneLine(raw.name, LIMITS.name);
	if (!name) return null;
	let count = 0;
	const ids = new Set<string>();
	const items = (value: unknown, depth: number): MenuItem[] => {
		if (!Array.isArray(value) || depth > LIMITS.depth) return [];
		const list: MenuItem[] = [];
		for (const entry of value) {
			if (count >= LIMITS.items) break;
			if (!isObject(entry) || typeof entry.id !== 'string' || !ITEM_ID.test(entry.id) || ids.has(entry.id)) continue;
			const label = oneLine(entry.label, LIMITS.label);
			if (!label) continue;
			ids.add(entry.id);
			count++;
			const item: MenuItem = { id: entry.id, label, link: entry.link == null ? null : cleanLinkValue(entry.link) };
			const labels = cleanLabels(entry.labels);
			if (labels) item.labels = labels;
			const description = oneLine(entry.description, LIMITS.description);
			if (description) item.description = description;
			const className = cleanClassName(entry.className);
			if (className) item.className = className;
			if (entry.visibility === 'logged-in' || entry.visibility === 'logged-out') item.visibility = entry.visibility;
			if (entry.enabled === false) item.enabled = false;
			const children = items(entry.children, depth + 1);
			if (children.length) item.children = children;
			list.push(item);
		}
		return list;
	};
	return { id: raw.id, name, items: items(raw.items, 1) };
}

/** Every item of a menu, depth first (with its parent's id). */
export function flatten(
	items: readonly MenuItem[],
	parent: string | null = null,
): Array<{ item: MenuItem; parent: string | null }> {
	return items.flatMap((item) => [{ item, parent }, ...flatten(item.children ?? [], item.id)]);
}

/** A link as `<Menu>` gets it from Tapestry (`resolveSiteLinks`): null when gone, unpublished or untranslated. */
export interface ResolvedHref {
	href: string;
	external: boolean;
	newTab: boolean;
	rel: string | undefined;
}

/** One item as rendered: what visitors can see, with the current page and its trail marked. */
export interface RenderItem {
	id: string;
	label: string;
	href: string | null;
	newTab: boolean;
	rel: string | undefined;
	external: boolean;
	description: string | undefined;
	/** `menu__item menu__item--<label>` plus the item's own classes and state classes. */
	classes: string[];
	/** This item's link is the current page. */
	current: boolean;
	/** The current page is this item or below it. */
	inTrail: boolean;
	children: RenderItem[];
}

export interface RenderOptions {
	/** Resolved links by item id (items with a page link that resolved to null are left out). */
	links: ReadonlyMap<string, ResolvedHref | null>;
	loggedIn: boolean;
	/** The page's language (labels), or null. */
	lang: string | null;
	/** The current path, e.g. `/about/team` (for the active trail). */
	currentPath: string;
	/** Show from this level (2: the children of the current top-level item). Default 1. */
	startLevel?: number;
	/** Levels to show from the start level. Default: all. */
	maxDepth?: number;
}

const normalizePath = (path: string) => (path.replace(/\/+$/, '') || '/').toLowerCase();

/** The items visitors see, with classes and the active trail (ADR 0001). */
export function renderMenu(menu: Menu, options: RenderOptions): RenderItem[] {
	const current = normalizePath(options.currentPath);
	const build = (items: readonly MenuItem[]): RenderItem[] =>
		items.flatMap((item) => {
			if (item.enabled === false) return [];
			if (item.visibility === 'logged-in' && !options.loggedIn) return [];
			if (item.visibility === 'logged-out' && options.loggedIn) return [];
			const link = item.link ? (options.links.get(item.id) ?? null) : null;
			// A link that doesn't resolve (page gone, unpublished, untranslated): the item and its children go.
			if (item.link && !link) return [];
			const children = build(item.children ?? []);
			const isCurrent = Boolean(link && !link.external && normalizePath(link.href.split(/[?#]/)[0] ?? '') === current);
			const inTrail = isCurrent || children.some((c) => c.inTrail);
			const label = (options.lang && item.labels?.[options.lang]) || item.label;
			const classes = [
				'menu__item',
				`menu__item--${classSlug(item.label)}`,
				...(item.className ? item.className.split(' ') : []),
				...(children.length ? ['menu__item--has-children'] : []),
				...(isCurrent ? ['menu__item--current'] : inTrail ? ['menu__item--trail'] : []),
			];
			return [
				{
					id: item.id,
					label,
					href: link?.href ?? null,
					newTab: link?.newTab ?? false,
					rel: link?.rel,
					external: link?.external ?? false,
					description: item.description,
					classes,
					current: isCurrent,
					inTrail,
					children,
				},
			];
		});
	let level = build(menu.items);
	// A start level below the top: the children of the trail item one level up (none off the trail).
	for (let depth = 1; depth < Math.max(1, Math.floor(options.startLevel ?? 1)); depth++) {
		level = level.find((item) => item.inTrail)?.children ?? [];
	}
	const cut = (items: RenderItem[], left: number): RenderItem[] =>
		items.map((item) => ({ ...item, children: left > 1 ? cut(item.children, left - 1) : [] }));
	return options.maxDepth && options.maxDepth > 0 ? cut(level, Math.floor(options.maxDepth)) : level;
}

/** The active trail, top level first (for `<Breadcrumbs>`); empty when the page isn't in the menu. */
export function trail(items: readonly RenderItem[]): RenderItem[] {
	const found = items.find((item) => item.inTrail);
	return found ? [found, ...trail(found.children)] : [];
}

/** Where a page is linked in a menu: the items whose link is that page (for the page editor). */
export function placementsOf(menu: Menu, pageId: string): Array<{ item: MenuItem; parent: string | null }> {
	return flatten(menu.items).filter(({ item }) => item.link?.type === 'page' && item.link.page === pageId);
}

/** The menu with an item added under `parent` (null: top level), at the end. */
export function addItem(menu: Menu, parent: string | null, item: MenuItem): Menu {
	if (parent === null) return { ...menu, items: [...menu.items, item] };
	const insert = (items: readonly MenuItem[]): MenuItem[] =>
		items.map((i) =>
			i.id === parent
				? { ...i, children: [...(i.children ?? []), item] }
				: i.children
					? { ...i, children: insert(i.children) }
					: i,
		);
	return { ...menu, items: insert(menu.items) };
}

/** The menu without an item (and its children). */
export function removeItem(menu: Menu, id: string): Menu {
	const remove = (items: readonly MenuItem[]): MenuItem[] =>
		items.flatMap((i) =>
			i.id === id ? [] : [i.children ? withoutEmptyChildren({ ...i, children: remove(i.children) }) : i],
		);
	return { ...menu, items: remove(menu.items) };
}

function withoutEmptyChildren(item: MenuItem): MenuItem {
	if (!item.children || item.children.length) return item;
	const { children: _, ...rest } = item;
	return rest;
}

/** An item and where it is: its parent's id (null: top level), its index there, its level (1 = top). */
export function locate(
	items: readonly MenuItem[],
	id: string,
	parent: string | null = null,
	level = 1,
): { item: MenuItem; parent: string | null; index: number; level: number } | null {
	for (const [index, item] of items.entries()) {
		if (item.id === id) return { item, parent, index, level };
		const found = item.children ? locate(item.children, id, item.id, level + 1) : null;
		if (found) return found;
	}
	return null;
}

/** Levels in an item's branch (1: no children). */
export const height = (item: MenuItem): number => 1 + Math.max(0, ...(item.children ?? []).map(height));

/** The menu with one item changed (`changes` merged; undefined values remove the key). */
export function updateItem(menu: Menu, id: string, changes: Partial<Omit<MenuItem, 'id' | 'children'>>): Menu {
	const update = (items: readonly MenuItem[]): MenuItem[] =>
		items.map((i) => {
			if (i.id !== id) return i.children ? { ...i, children: update(i.children) } : i;
			const next: Record<string, unknown> = { ...i, ...changes };
			for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
			return next as unknown as MenuItem;
		});
	return { ...menu, items: update(menu.items) };
}

/**
 * The menu with an item moved under `parent` (null: top level) at `index` (counted without the item),
 * or null when that isn't possible: into itself or its own branch, or deeper than LIMITS.depth.
 */
export function moveItem(menu: Menu, id: string, parent: string | null, index: number): Menu | null {
	const found = locate(menu.items, id);
	if (!found) return null;
	let level = 1;
	if (parent !== null) {
		if (parent === id || locate(found.item.children ?? [], parent)) return null;
		const target = locate(menu.items, parent);
		if (!target) return null;
		level = target.level + 1;
	}
	if (level + height(found.item) - 1 > LIMITS.depth) return null;
	const without = removeItem(menu, id);
	const insert = (items: readonly MenuItem[]): MenuItem[] => {
		const at = Math.max(0, Math.min(index, items.length));
		return [...items.slice(0, at), found.item, ...items.slice(at)];
	};
	if (parent === null) return { ...without, items: insert(without.items) };
	const into = (items: readonly MenuItem[]): MenuItem[] =>
		items.map((i) =>
			i.id === parent
				? { ...i, children: insert(i.children ?? []) }
				: i.children
					? { ...i, children: into(i.children) }
					: i,
		);
	return { ...without, items: into(without.items) };
}

/** A drop on an item, as the tree hitbox describes it (Pragmatic DnD's tree-item instruction). */
export type DropInstruction =
	| { type: 'reorder-above' | 'reorder-below' | 'make-child' }
	| { type: 'reparent'; desiredLevel: number }
	| { type: 'instruction-blocked' };

/**
 * The menu after dropping `source` on `target` (ADR 0001), or null when the drop isn't possible.
 * `reparent` (dragging left below the last child) moves it after the target's ancestor at
 * `desiredLevel` (0-based, like the hitbox's levels).
 */
export function applyDrop(menu: Menu, sourceId: string, targetId: string, drop: DropInstruction): Menu | null {
	if (sourceId === targetId || drop.type === 'instruction-blocked') return null;
	const source = locate(menu.items, sourceId);
	const target = locate(menu.items, targetId);
	if (!source || !target) return null;
	/** Index under `parent` counted without the source (moveItem's convention). */
	const indexAfterRemoval = (parent: string | null, index: number) =>
		source.parent === parent && source.index < index ? index - 1 : index;
	switch (drop.type) {
		case 'reorder-above':
			return moveItem(menu, sourceId, target.parent, indexAfterRemoval(target.parent, target.index));
		case 'reorder-below':
			return moveItem(menu, sourceId, target.parent, indexAfterRemoval(target.parent, target.index + 1));
		case 'make-child':
			return moveItem(menu, sourceId, targetId, 0);
		case 'reparent': {
			// The target's ancestors, top first, ending with the target itself.
			const path: string[] = [];
			for (let at: string | null = targetId; at; at = locate(menu.items, at)?.parent ?? null) path.unshift(at);
			const anchorId = path[drop.desiredLevel];
			const anchor = anchorId ? locate(menu.items, anchorId) : null;
			if (!anchor) return null;
			return moveItem(menu, sourceId, anchor.parent, indexAfterRemoval(anchor.parent, anchor.index + 1));
		}
	}
}

/** Items a new item can go under (not too deep), in tree order with their level, for a parent picker. */
export function parentChoices(menu: Menu, except?: string): Array<{ id: string; label: string; level: number }> {
	const choices: Array<{ id: string; label: string; level: number }> = [];
	const walk = (items: readonly MenuItem[], level: number) => {
		for (const item of items) {
			if (item.id === except) continue;
			if (level < LIMITS.depth) choices.push({ id: item.id, label: item.label, level });
			walk(item.children ?? [], level + 1);
		}
	};
	walk(menu.items, 1);
	return choices;
}
