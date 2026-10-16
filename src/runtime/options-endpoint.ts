/**
 * `/_menus/options` (editors): the menus as choices for the Menu and Breadcrumbs components' select
 * (Tapestry ADR 0042): `{ options: [{ value: id, label: name }] }`.
 */
import type { APIRoute } from 'astro';
import { json, roleOf } from './http.js';
import { ensureDefaultMenu, listMenus } from './menus-store.js';

export const prerender = false;

export const GET: APIRoute = async (context) => {
	if (!(await roleOf(context)).editor) return json({ error: 'Editors only' }, 403);
	try {
		await ensureDefaultMenu();
		const menus = await listMenus();
		return json({ options: menus.map(({ menu }) => ({ value: menu.id, label: menu.name })) });
	} catch (error) {
		console.error('[tapestry-menus] reading menus failed', error);
		return json({ error: 'Reading menus failed' }, 500);
	}
};
