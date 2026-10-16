/**
 * `/_menus/menus` (ADR 0001):
 * - GET (editors): every menu `{ menus: [{ menu, rev }], canEdit }`, or one with `?id=` `{ menu, rev, canEdit }`.
 * - POST (admins, same origin, JSON): `{ action: 'create', name }`, `{ action: 'save', menu, rev }`
 *   (refused with 409 and the current version when `rev` is outdated) or `{ action: 'delete', id }`.
 *   Saving makes the menu live at once (menus have no drafts). Everything is validated again (parseMenu).
 */
import { randomBytes } from 'node:crypto';
import type { APIRoute } from 'astro';
import { LIMITS, MENU_ID, newId, oneLine, parseMenu } from '../menus.js';
import { json, readBody, roleOf } from './http.js';
import { deleteMenu, listMenus, loadMenu, MenuConflictError, saveMenu } from './menus-store.js';

export const prerender = false;

/** A full menu (300 items with labels in several languages) is well under this. */
const MAX_BODY = 512 * 1024;

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

export const GET: APIRoute = async (context) => {
	const role = await roleOf(context);
	if (!role.editor) return json({ error: 'Editors only' }, 403);
	try {
		const id = context.url.searchParams.get('id');
		if (id !== null) {
			const stored = await loadMenu(id);
			return stored ? json({ ...stored, canEdit: role.admin }) : json({ error: 'No such menu' }, 404);
		}
		return json({ menus: await listMenus(), canEdit: role.admin });
	} catch (error) {
		console.error('[tapestry-menus] reading menus failed', error);
		return json({ error: 'Reading menus failed' }, 500);
	}
};

export const POST: APIRoute = async (context) => {
	const body = await readBody(context, MAX_BODY);
	if (body instanceof Response) return body;
	if (!(await roleOf(context)).admin) return json({ error: 'Only admins can change menus' }, 403);
	if (!isObject(body)) return json({ error: 'Unknown action' }, 400);
	try {
		switch (body.action) {
			case 'create': {
				const name = oneLine(body.name, LIMITS.name);
				if (!name) return json({ error: 'Give the menu a name' }, 400);
				const menu = { id: newId('mn_', randomBytes), name, items: [] };
				return json(await saveMenu(menu, null), 201);
			}
			case 'save': {
				const menu = parseMenu(body.menu);
				const rev = body.rev;
				if (!menu || typeof rev !== 'number' || !Number.isSafeInteger(rev)) {
					return json({ error: 'Not a valid menu' }, 400);
				}
				return json(await saveMenu(menu, rev));
			}
			case 'delete': {
				if (typeof body.id !== 'string' || !MENU_ID.test(body.id)) return json({ error: 'No such menu' }, 404);
				await deleteMenu(body.id);
				return json({ deleted: body.id });
			}
			default:
				return json({ error: 'Unknown action' }, 400);
		}
	} catch (error) {
		if (error instanceof MenuConflictError) {
			return json(
				{ error: 'Someone else changed this menu meanwhile. Your changes were not saved.', current: error.current },
				409,
			);
		}
		if (error instanceof Error && error.message === 'too many menus') {
			return json({ error: 'There are too many menus already' }, 400);
		}
		console.error('[tapestry-menus] saving a menu failed', error);
		return json({ error: 'Saving failed' }, 500);
	}
};
