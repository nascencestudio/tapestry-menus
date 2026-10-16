/// <reference types="studiocms/v/types" />
/**
 * `@nascencestudio/tapestry-menus/menus`: menus as data, for sites that write their own markup (ADR 0001).
 * `<Menu>` and `<Breadcrumbs>` are built on these. Links resolve like Tapestry's link props (current
 * paths, the page's language, unpublished pages hidden from visitors); items whose page isn't visible
 * (or has no version in the page's language) are left out with their children. Call getPage() first
 * on routes, so links and labels follow the page's language.
 */
import { getViewer, pageLanguage, resolveSiteLinks } from '@nascencestudio/tapestry/page';
import type { AstroGlobal } from 'astro';
import { flatten, menuClasses, type RenderItem, type ResolvedHref, renderMenu, trail } from '../menus.js';
import { menuForRequest } from './menus-store.js';

export type { RenderItem } from '../menus.js';

type Context = Pick<AstroGlobal, 'cookies' | 'locals' | 'url'>;

export interface MenuOptions {
	/** Show from this level (2: the children of the current top-level item). Default 1. */
	startLevel?: number;
	/** Levels to show (0 or leaving it out: all). */
	maxDepth?: number;
}

export interface MenuData {
	id: string;
	name: string;
	/** `menu menu--<name>`. */
	classes: string[];
	items: RenderItem[];
}

const VIEWER = Symbol.for('tapestry-menus.logged-in');

/** Whether someone is logged in, checked once per request. */
function loggedIn(context: Context): Promise<boolean> {
	const store = context.locals as unknown as Record<symbol, Promise<boolean> | undefined>;
	store[VIEWER] ??= getViewer(context)
		.then((viewer) => viewer.isLoggedIn)
		.catch(() => false);
	return store[VIEWER];
}

/** A menu as the current viewer sees it on the current page; null when it doesn't exist. */
export async function getMenu(context: Context, id: string, options: MenuOptions = {}): Promise<MenuData | null> {
	const menu = await menuForRequest(context.locals, id);
	if (!menu) return null;
	const linked = flatten(menu.items).filter(({ item }) => item.link);
	const [resolved, isLoggedIn] = await Promise.all([
		resolveSiteLinks(
			context,
			linked.map(({ item }) => item.link),
			{ hideUntranslated: true },
		),
		loggedIn(context),
	]);
	const links = new Map<string, ResolvedHref | null>(
		linked.map(({ item }, index) => [item.id, resolved[index] ?? null]),
	);
	const items = renderMenu(menu, {
		links,
		loggedIn: isLoggedIn,
		lang: pageLanguage(context),
		currentPath: context.url.pathname,
		...options,
	});
	return { id: menu.id, name: menu.name, classes: menuClasses(menu), items };
}

/** The current page's trail in a menu, top level first; empty when the page isn't in it (or no menu). */
export async function getBreadcrumbs(context: Context, id: string): Promise<RenderItem[]> {
	const menu = await getMenu(context, id);
	return menu ? trail(menu.items) : [];
}
