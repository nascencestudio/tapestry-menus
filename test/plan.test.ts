import { describe, expect, it } from 'vitest';
import type { StoredMenu } from '../src/client/api.js';
import { initialForm, keyOf, type PageData, planSave } from '../src/editor/plan.js';
import { LIMITS, locate, type MenuItem } from '../src/menus.js';

const PAGE = 'page-about';
const pageLink = { type: 'page' as const, page: PAGE };
const item = (id: string, extra: Partial<MenuItem> = {}): MenuItem => ({ id, label: id, link: null, ...extra });
const main: StoredMenu = {
	rev: 3,
	menu: {
		id: 'mn_main000000000000',
		name: 'Main',
		items: [
			item('mi_home00000000'),
			item('mi_about0000000', { label: 'About us', link: pageLink, children: [item('mi_team00000000')] }),
		],
	},
};
const footer: StoredMenu = {
	rev: 1,
	menu: { id: 'mn_foot000000000000', name: 'Footer', items: [item('mi_legal0000000')] },
};
const data = (menus: StoredMenu[]): PageData => ({
	page: { id: PAGE, title: 'About', path: '/about' },
	menus,
	canEdit: true,
});
const newId = () => 'mi_new000000000';

describe('menu settings', () => {
	it('starts from the first link, or from the page title at the first menu’s top level', () => {
		expect(initialForm(data([main, footer]))).toEqual({
			provide: true,
			label: 'About us',
			description: '',
			parent: 'mn_main000000000000:',
		});
		expect(initialForm(data([footer]))).toEqual({
			provide: false,
			label: 'About',
			description: '',
			parent: 'mn_foot000000000000:',
		});
	});

	it('adds a link under the chosen parent', () => {
		const plan = planSave(
			[footer],
			PAGE,
			{ provide: true, label: ' About ', description: '', parent: keyOf(footer.menu.id, 'mi_legal0000000') },
			newId,
		);
		expect('saves' in plan && plan.saves).toEqual([
			{
				rev: 1,
				menu: {
					...footer.menu,
					items: [item('mi_legal0000000', { children: [{ id: 'mi_new000000000', label: 'About', link: pageLink }] })],
				},
			},
		]);
	});

	it('renames and moves within a menu, keeping the rev to check against', () => {
		const plan = planSave(
			[main],
			PAGE,
			{ provide: true, label: 'About', description: 'Who we are', parent: keyOf(main.menu.id, 'mi_home00000000') },
			newId,
		);
		if (!('saves' in plan)) throw new Error(plan.error);
		expect(plan.saves[0]?.rev).toBe(3);
		expect(locate(plan.saves[0]?.menu.items ?? [], 'mi_about0000000')).toMatchObject({
			parent: 'mi_home00000000',
			item: { label: 'About', description: 'Who we are', children: [item('mi_team00000000')] },
		});
	});

	it('moves to another menu with its children: the new menu first, then the old one', () => {
		const plan = planSave(
			[main, footer],
			PAGE,
			{ provide: true, label: 'About us', description: '', parent: keyOf(footer.menu.id, null) },
			newId,
		);
		if (!('saves' in plan)) throw new Error(plan.error);
		expect(plan.saves.map((s) => s.menu.id)).toEqual([footer.menu.id, main.menu.id]);
		expect(plan.saves[0]?.menu.items[1]).toMatchObject({
			id: 'mi_about0000000',
			children: [{ id: 'mi_team00000000' }],
		});
		expect(locate(plan.saves[1]?.menu.items ?? [], 'mi_about0000000')).toBeNull();
	});

	it('removes the link when unticked, and does nothing when there was none', () => {
		const plan = planSave([main], PAGE, { provide: false, label: '', description: '', parent: '' }, newId);
		expect('saves' in plan && plan.saves[0]?.menu.items.map((i) => i.id)).toEqual(['mi_home00000000']);
		expect(planSave([footer], PAGE, { provide: false, label: '', description: '', parent: '' }, newId)).toEqual({
			saves: [],
		});
	});

	it('refuses an empty title, an unknown menu and too deep a place', () => {
		const form = { provide: true, label: '  ', description: '', parent: keyOf(main.menu.id, null) };
		expect(planSave([main], PAGE, form, newId)).toEqual({ error: 'Give the menu link a title.' });
		expect(planSave([main], PAGE, { ...form, label: 'x', parent: 'mn_nope000000000000:' }, newId)).toHaveProperty(
			'error',
		);
		let deep: MenuItem = item('mi_deep0000000a');
		for (let n = 1; n < LIMITS.depth; n++)
			deep = item(`mi_deep000000${String.fromCharCode(97 + n)}a`, { children: [deep] });
		const tall: StoredMenu = { rev: 1, menu: { id: 'mn_tall000000000000', name: 'Tall', items: [deep] } };
		const plan = planSave([tall], PAGE, { ...form, label: 'x', parent: keyOf(tall.menu.id, 'mi_deep0000000a') }, newId);
		expect(plan).toEqual({ error: 'That item is already as deep as menus go.' });
	});
});
