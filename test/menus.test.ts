import { describe, expect, it } from 'vitest';
import {
	addItem,
	applyDrop,
	classSlug,
	LIMITS,
	locate,
	type Menu,
	type MenuItem,
	menuClasses,
	moveItem,
	newId,
	oneLine,
	parentChoices,
	parseMenu,
	placementsOf,
	type ResolvedHref,
	removeItem,
	renderMenu,
	trail,
	updateItem,
} from '../src/menus.js';

const MENU = 'mn_abcdefghij012345';
const id = (n: number) => `mi_item${String(n).padStart(8, '0')}`;
const page = (p: string) => ({ type: 'page' as const, page: p });
const item = (n: number, extra: Partial<MenuItem> = {}): MenuItem => ({
	id: id(n),
	label: `Item ${n}`,
	link: page(`page-${n}`),
	...extra,
});
const internal = (href: string): ResolvedHref => ({ href, external: false, newTab: false, rel: undefined });

/** Home, About (Team, History (Archive)), Blog, Contact (logged out only). */
const menu: Menu = {
	id: MENU,
	name: 'Main navigation',
	items: [
		item(1, { label: 'Home' }),
		item(2, {
			label: 'About',
			children: [item(3, { label: 'Team' }), item(4, { label: 'History', children: [item(5, { label: 'Archive' })] })],
		}),
		item(6, { label: 'Blog' }),
		item(7, { label: 'Contact', visibility: 'logged-out' }),
	],
};
const links = new Map<string, ResolvedHref | null>([
	[id(1), internal('/')],
	[id(2), internal('/about')],
	[id(3), internal('/about/team')],
	[id(4), internal('/about/history')],
	[id(5), internal('/about/history/archive')],
	[id(6), internal('/blog')],
	[id(7), internal('/contact')],
]);
const render = (extra: Partial<Parameters<typeof renderMenu>[1]> = {}) =>
	renderMenu(menu, { links, loggedIn: false, lang: null, currentPath: '/', ...extra });
const labels = (items: ReturnType<typeof renderMenu>): unknown =>
	items.map((i) => (i.children.length ? [i.label, labels(i.children)] : i.label));

describe('ids, text and class names', () => {
	it('makes ids of the right shape', () => {
		const random = (n: number) => new Uint8Array(n).map((_, i) => i * 37);
		expect(newId('mn_', random)).toMatch(/^mn_[a-z0-9]{16}$/);
		expect(newId('mi_', random)).toMatch(/^mi_[a-z0-9]{12}$/);
	});

	it('keeps text on one line', () => {
		expect(oneLine('  A\n\tB\u0000C  ', 10)).toBe('A B C');
		expect(oneLine(42, 10)).toBe('');
		expect(oneLine('x'.repeat(20), 5)).toBe('xxxxx');
	});

	it('derives CSS-safe class names from labels', () => {
		expect(classSlug('Main navigation')).toBe('main-navigation');
		expect(classSlug('À propos')).toBe('a-propos');
		expect(classSlug('  FAQ & Help!! ')).toBe('faq-help');
		expect(classSlug('2024 Report')).toBe('n2024-report');
		expect(classSlug('"><script>')).toBe('script');
		expect(classSlug('日本語')).toBe('item');
		expect(classSlug('---', 'menu')).toBe('menu');
		expect(menuClasses({ name: 'Footer links' })).toEqual(['menu', 'menu--footer-links']);
		for (const slug of [classSlug('a'.repeat(200)), classSlug(`${'é'.repeat(60)}-x`)]) {
			expect(slug).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/);
			expect(slug.length).toBeLessThanOrEqual(51);
		}
	});
});

describe('parseMenu', () => {
	it('keeps a valid menu as it is', () => {
		expect(parseMenu(JSON.parse(JSON.stringify(menu)))).toEqual(menu);
	});

	it('refuses menus without a valid id or a name', () => {
		expect(parseMenu(null)).toBeNull();
		expect(parseMenu([])).toBeNull();
		expect(parseMenu({ ...menu, id: 'mn_short' })).toBeNull();
		expect(parseMenu({ ...menu, id: '__proto__' })).toBeNull();
		expect(parseMenu({ ...menu, name: '  \n ' })).toBeNull();
	});

	it('drops unknown keys, bad items and duplicate ids', () => {
		const parsed = parseMenu({
			id: MENU,
			name: 'M',
			extra: 1,
			items: [
				{ ...item(1), onclick: 'x', style: 'color:red' },
				item(1),
				{ id: 'bad', label: 'x', link: null },
				{ id: id(2), label: '', link: null },
				'string',
				{ id: id(3), label: 'Plain', link: null, enabled: true, visibility: 'admins' },
			],
		});
		expect(parsed?.items).toEqual([item(1), { id: id(3), label: 'Plain', link: null }]);
		expect(Object.keys(parsed ?? {})).toEqual(['id', 'name', 'items']);
	});

	it('validates links like Tapestry link props', () => {
		const items = parseMenu({
			id: MENU,
			name: 'M',
			items: [
				{ id: id(1), label: 'a', link: { type: 'url', url: 'javascript:alert(1)' } },
				{ id: id(2), label: 'b', link: { type: 'url', url: 'https://example.com', newTab: true } },
				{ id: id(3), label: 'c', link: { type: 'page', page: '../x' } },
				{ id: id(4), label: 'd', link: '/about' },
			],
		})?.items;
		expect(items?.map((i) => i.link)).toEqual([
			null,
			{ type: 'url', url: 'https://example.com', newTab: true },
			null,
			{ type: 'url', url: '/about' },
		]);
	});

	it('keeps only safe class names and valid language labels', () => {
		const [parsed] =
			parseMenu({
				id: MENU,
				name: 'M',
				items: [
					{
						...item(1),
						className: 'ok another-one "><b> 1bad ok x{y}',
						labels: { fr: 'Accueil', 'not a lang': 'x', de: '', es: 42, 'pt-BR': 'Início' },
						description: 'Line\none',
					},
				],
			})?.items ?? [];
		expect(parsed?.className).toBe('ok another-one');
		expect(parsed?.labels).toEqual({ fr: 'Accueil', 'pt-BR': 'Início' });
		expect(parsed?.description).toBe('Line one');
	});

	it('limits depth and the number of items', () => {
		let deep: MenuItem = item(99);
		for (let n = 20; n > 0; n--) deep = item(n, { children: [deep] });
		const parsed = parseMenu({ id: MENU, name: 'M', items: [deep] });
		let level = 0;
		for (let node: MenuItem | undefined = parsed?.items[0]; node; node = node.children?.[0]) level++;
		expect(level).toBe(LIMITS.depth);

		const many = Array.from({ length: 500 }, (_, n) => item(n));
		expect(parseMenu({ id: MENU, name: 'M', items: many })?.items).toHaveLength(LIMITS.items);
	});
});

describe('renderMenu', () => {
	it('shows what visitors may see, in order, nested', () => {
		expect(labels(render())).toEqual(['Home', ['About', ['Team', ['History', ['Archive']]]], 'Blog', 'Contact']);
		expect(labels(render({ loggedIn: true }))).toEqual(['Home', ['About', ['Team', ['History', ['Archive']]]], 'Blog']);
	});

	it('hides logged-in items from visitors and disabled items from everyone', () => {
		const m = updateItem(updateItem(menu, id(6), { visibility: 'logged-in' }), id(3), { enabled: false });
		const visible = (loggedIn: boolean) => labels(renderMenu(m, { links, loggedIn, lang: null, currentPath: '/' }));
		expect(visible(false)).toEqual(['Home', ['About', [['History', ['Archive']]]], 'Contact']);
		expect(visible(true)).toEqual(['Home', ['About', [['History', ['Archive']]]], 'Blog']);
	});

	it('leaves out links that do not resolve, with their branch', () => {
		const partial = new Map(links);
		partial.set(id(4), null);
		partial.delete(id(6));
		expect(labels(render({ links: partial }))).toEqual(['Home', ['About', ['Team']], 'Contact']);
	});

	it('keeps label-only items as headings', () => {
		const m = updateItem(menu, id(2), { link: null });
		const [, about] = renderMenu(m, { links, loggedIn: false, lang: null, currentPath: '/' });
		expect(about?.href).toBeNull();
		expect(about?.children).toHaveLength(2);
	});

	it('marks the current page and its trail', () => {
		const items = render({ currentPath: '/about/history/' });
		const about = items[1];
		expect(about?.inTrail).toBe(true);
		expect(about?.current).toBe(false);
		expect(about?.classes).toContain('menu__item--trail');
		const history = about?.children[1];
		expect(history?.current).toBe(true);
		expect(history?.classes).toEqual([
			'menu__item',
			'menu__item--history',
			'menu__item--has-children',
			'menu__item--current',
		]);
		expect(items[0]?.inTrail).toBe(false);
		expect(trail(items).map((i) => i.label)).toEqual(['About', 'History']);
		expect(trail(render({ currentPath: '/elsewhere' }))).toEqual([]);
	});

	it('ignores query strings and external links for the current page', () => {
		const ext = new Map(links);
		ext.set(id(6), { href: 'https://other.example/blog', external: true, newTab: true, rel: 'noopener noreferrer' });
		const items = render({ links: ext, currentPath: '/blog' });
		expect(items[2]?.current).toBe(false);
		expect(items[2]?.newTab).toBe(true);
		expect(items[2]?.rel).toBe('noopener noreferrer');
		const query = new Map(links);
		query.set(id(6), internal('/blog?page=2#top'));
		expect(render({ links: query, currentPath: '/blog' })[2]?.current).toBe(true);
	});

	it('adds the label class and the item’s own classes', () => {
		const m = updateItem(menu, id(1), { className: 'button primary' });
		expect(renderMenu(m, { links, loggedIn: false, lang: null, currentPath: '/x' })[0]?.classes).toEqual([
			'menu__item',
			'menu__item--home',
			'button',
			'primary',
		]);
	});

	it('uses the label for the page’s language, falling back to the default', () => {
		const m = updateItem(menu, id(1), { labels: { fr: 'Accueil' } });
		const first = (lang: string | null) => renderMenu(m, { links, loggedIn: false, lang, currentPath: '/' })[0];
		expect(first('fr')?.label).toBe('Accueil');
		expect(first('de')?.label).toBe('Home');
		expect(first(null)?.label).toBe('Home');
		// The class stays the same in every language.
		expect(first('fr')?.classes).toContain('menu__item--home');
	});

	it('starts at a level, following the trail', () => {
		expect(labels(render({ startLevel: 2, currentPath: '/about/team' }))).toEqual(['Team', ['History', ['Archive']]]);
		expect(labels(render({ startLevel: 2, currentPath: '/about' }))).toEqual(['Team', ['History', ['Archive']]]);
		expect(labels(render({ startLevel: 2, currentPath: '/blog' }))).toEqual([]);
		expect(labels(render({ startLevel: 3, currentPath: '/about/history/archive' }))).toEqual(['Archive']);
	});

	it('limits the depth', () => {
		expect(labels(render({ maxDepth: 1 }))).toEqual(['Home', 'About', 'Blog', 'Contact']);
		expect(labels(render({ maxDepth: 2 }))).toEqual(['Home', ['About', ['Team', 'History']], 'Blog', 'Contact']);
		expect(labels(render({ startLevel: 2, maxDepth: 1, currentPath: '/about' }))).toEqual(['Team', 'History']);
	});
});

describe('editing', () => {
	it('finds where a page is linked', () => {
		const m = addItem(menu, id(6), item(8, { link: page('page-3') }));
		expect(placementsOf(m, 'page-3').map(({ item: i, parent }) => [i.id, parent])).toEqual([
			[id(3), id(2)],
			[id(8), id(6)],
		]);
		expect(placementsOf(m, 'nope')).toEqual([]);
	});

	it('adds and removes items', () => {
		const added = addItem(menu, null, item(9));
		expect(added.items.at(-1)?.id).toBe(id(9));
		expect(menu.items).toHaveLength(4);
		const removed = removeItem(menu, id(4));
		expect(locate(removed.items, id(5))).toBeNull();
		expect(locate(removed.items, id(2))?.item.children?.map((i) => i.id)).toEqual([id(3)]);
		// An item that loses its last child has no empty children list.
		expect(locate(removeItem(removed, id(3)).items, id(2))?.item).not.toHaveProperty('children');
	});

	it('updates an item, removing keys set to undefined', () => {
		const m = updateItem(updateItem(menu, id(7), { label: 'Write to us', visibility: undefined }), id(5), {
			description: 'Old posts',
		});
		expect(locate(m.items, id(7))?.item).toEqual({ id: id(7), label: 'Write to us', link: page('page-7') });
		expect(locate(m.items, id(5))?.item.description).toBe('Old posts');
	});

	it('moves items, keeping their branch', () => {
		const m = moveItem(menu, id(4), null, 0);
		expect(m?.items.map((i) => i.id)).toEqual([id(4), id(1), id(2), id(6), id(7)]);
		expect(m?.items[0]?.children?.[0]?.id).toBe(id(5));
		const nested = moveItem(menu, id(6), id(5), 0);
		expect(locate(nested?.items ?? [], id(6))).toMatchObject({ parent: id(5), level: 4 });
		const reordered = moveItem(menu, id(1), null, 2);
		expect(reordered?.items.map((i) => i.id)).toEqual([id(2), id(6), id(1), id(7)]);
	});

	it('refuses impossible moves', () => {
		expect(moveItem(menu, id(2), id(2), 0)).toBeNull();
		expect(moveItem(menu, id(2), id(5), 0)).toBeNull();
		expect(moveItem(menu, 'mi_missing00000', null, 0)).toBeNull();
		expect(moveItem(menu, id(1), 'mi_missing00000', 0)).toBeNull();
		let deep = menu;
		let parent = id(5);
		for (let n = 10; n < 13; n++) {
			deep = addItem(deep, parent, item(n));
			parent = id(n);
		}
		// Level 6 is the deepest: nothing goes under a level-6 item, and About's branch (now 6 levels) only fits at the top.
		expect(locate(deep.items, id(12))?.level).toBe(6);
		expect(moveItem(deep, id(6), id(12), 0)).toBeNull();
		expect(moveItem(deep, id(6), id(11), 0)).not.toBeNull();
		expect(moveItem(deep, id(2), id(6), 0)).toBeNull();
		expect(moveItem(deep, id(1), id(10), 0)).not.toBeNull();
		expect(moveItem(removeItem(deep, id(11)), id(6), id(10), 0)).not.toBeNull();
	});
});

describe('drag and drop', () => {
	const order = (m: Menu | null): unknown =>
		m?.items.map((i) => (i.children ? [i.id.slice(-1), order({ ...m, items: i.children })] : i.id.slice(-1)));

	it('reorders above and below', () => {
		expect(order(applyDrop(menu, id(6), id(1), { type: 'reorder-above' }))).toEqual([
			'6',
			'1',
			['2', ['3', ['4', ['5']]]],
			'7',
		]);
		expect(order(applyDrop(menu, id(1), id(6), { type: 'reorder-below' }))).toEqual([
			['2', ['3', ['4', ['5']]]],
			'6',
			'1',
			'7',
		]);
		expect(order(applyDrop(menu, id(7), id(1), { type: 'reorder-below' }))).toEqual([
			'1',
			'7',
			['2', ['3', ['4', ['5']]]],
			'6',
		]);
		expect(order(applyDrop(menu, id(1), id(3), { type: 'reorder-above' }))).toEqual([
			['2', ['1', '3', ['4', ['5']]]],
			'6',
			'7',
		]);
	});

	it('makes children and reparents', () => {
		expect(order(applyDrop(menu, id(6), id(3), { type: 'make-child' }))).toEqual([
			'1',
			[
				'2',
				[
					['3', ['6']],
					['4', ['5']],
				],
			],
			'7',
		]);
		// Dropped below Archive (level 2, 0-based), dragged left to level 0: after About.
		expect(order(applyDrop(menu, id(1), id(5), { type: 'reparent', desiredLevel: 0 }))).toEqual([
			['2', ['3', ['4', ['5']]]],
			'1',
			'6',
			'7',
		]);
		// …to level 1: after History, inside About.
		expect(order(applyDrop(menu, id(6), id(5), { type: 'reparent', desiredLevel: 1 }))).toEqual([
			'1',
			['2', ['3', ['4', ['5']], '6']],
			'7',
		]);
	});

	it('refuses drops on itself, into its own branch or blocked', () => {
		expect(applyDrop(menu, id(2), id(2), { type: 'make-child' })).toBeNull();
		expect(applyDrop(menu, id(2), id(5), { type: 'make-child' })).toBeNull();
		expect(applyDrop(menu, id(2), id(3), { type: 'reorder-above' })).toBeNull();
		expect(applyDrop(menu, id(1), id(2), { type: 'instruction-blocked' })).toBeNull();
		expect(applyDrop(menu, id(1), id(5), { type: 'reparent', desiredLevel: 9 })).toBeNull();
	});

	it('lists possible parents', () => {
		expect(parentChoices(menu).map((c) => [c.label, c.level])).toEqual([
			['Home', 1],
			['About', 1],
			['Team', 2],
			['History', 2],
			['Archive', 3],
			['Blog', 1],
			['Contact', 1],
		]);
		expect(parentChoices(menu, id(2)).map((c) => c.label)).toEqual(['Home', 'Blog', 'Contact']);
	});
});
