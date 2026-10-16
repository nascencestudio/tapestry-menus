/**
 * The page editor's Menu settings as data (pure): where the page is linked, the form's starting values,
 * and which menus to save to apply it (ADR 0001).
 */
import type { StoredMenu } from '../client/api.js';
import {
	addItem,
	height,
	LIMITS,
	locate,
	type Menu,
	type MenuItem,
	moveItem,
	oneLine,
	placementsOf,
	removeItem,
	updateItem,
} from '../menus.js';

export interface PageData {
	page: { id: string; title: string; path: string };
	menus: StoredMenu[];
	canEdit: boolean;
}

/** Where a link sits: `menuId:` (the top level) or `menuId:itemId`. */
type ParentKey = string;

export interface Placement {
	menu: Menu;
	item: MenuItem;
	parent: string | null;
}

export interface FormState {
	provide: boolean;
	label: string;
	description: string;
	parent: ParentKey;
}

export const keyOf = (menuId: string, parent: string | null): ParentKey => `${menuId}:${parent ?? ''}`;
export const splitKey = (key: ParentKey) => {
	const [menuId = '', parent = ''] = key.split(':');
	return { menuId, parent: parent || null };
};

export function allPlacements(menus: readonly StoredMenu[], pageId: string): Placement[] {
	return menus.flatMap(({ menu }) => placementsOf(menu, pageId).map(({ item, parent }) => ({ menu, item, parent })));
}

export function initialForm(data: PageData): FormState {
	const first = allPlacements(data.menus, data.page.id)[0];
	if (first) {
		return {
			provide: true,
			label: first.item.label,
			description: first.item.description ?? '',
			parent: keyOf(first.menu.id, first.parent),
		};
	}
	return {
		provide: false,
		label: data.page.title.slice(0, LIMITS.label),
		description: '',
		parent: data.menus[0] ? keyOf(data.menus[0].menu.id, null) : '',
	};
}

/** The menus to save to apply the form (in order), or an error to show. */
export function planSave(
	menus: readonly StoredMenu[],
	pageId: string,
	form: FormState,
	newId: () => string,
): { saves: StoredMenu[] } | { error: string } {
	const first = allPlacements(menus, pageId)[0] ?? null;
	const byId = new Map(menus.map((stored) => [stored.menu.id, stored]));
	const label = oneLine(form.label, LIMITS.label);
	const description = oneLine(form.description, LIMITS.description) || undefined;
	if (!form.provide) {
		if (!first) return { saves: [] };
		const stored = byId.get(first.menu.id) as StoredMenu;
		return { saves: [{ ...stored, menu: removeItem(stored.menu, first.item.id) }] };
	}
	if (!label) return { error: 'Give the menu link a title.' };
	const target = splitKey(form.parent);
	const targetStored = byId.get(target.menuId);
	if (!targetStored) return { error: 'Choose where the link goes.' };
	const level = target.parent ? (locate(targetStored.menu.items, target.parent)?.level ?? 0) + 1 : 1;
	if (!first) {
		if (level > LIMITS.depth) return { error: 'That item is already as deep as menus go.' };
		const item: MenuItem = { id: newId(), label, link: { type: 'page', page: pageId } };
		if (description) item.description = description;
		return { saves: [{ ...targetStored, menu: addItem(targetStored.menu, target.parent, item) }] };
	}
	const changes = { label, description };
	if (first.menu.id === target.menuId) {
		let menu = updateItem(first.menu, first.item.id, changes);
		if (target.parent !== first.parent) {
			const moved = moveItem(menu, first.item.id, target.parent, Number.MAX_SAFE_INTEGER);
			if (!moved) return { error: 'The link can’t go there (under itself, or too deep).' };
			menu = moved;
		}
		return { saves: [{ ...targetStored, menu }] };
	}
	// Into another menu: the link moves with the items under it.
	if (level + height(first.item) - 1 > LIMITS.depth) return { error: 'That would make the menu too deep.' };
	const updated = locate(updateItem(first.menu, first.item.id, changes).items, first.item.id)?.item as MenuItem;
	const from = byId.get(first.menu.id) as StoredMenu;
	return {
		saves: [
			{ ...targetStored, menu: addItem(targetStored.menu, target.parent, updated) },
			{ ...from, menu: removeItem(from.menu, first.item.id) },
		],
	};
}
