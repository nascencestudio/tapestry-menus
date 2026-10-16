/// <reference types="studiocms/v/types" />
/**
 * Menus in StudioCMS's plugin data table, one row per menu (`@nascencestudio/tapestry-menu:<mn_…>`,
 * data `{ ...menu, rev }`). Re-validated on every read (parseMenu). `rev` counts saves, so a save made
 * from an outdated copy (two people editing, or the dashboard and a page's menu settings) is refused instead of
 * silently undoing the other change. Straight through the SDK's database client (`usePluginData()`
 * can't save in StudioCMS 0.6.1). Server only.
 */

import { randomBytes } from 'node:crypto';
import { runSDK, SDKCoreJs } from 'studiocms:sdk';
import { MENU_ID, type Menu, newId, parseMenu } from '../menus.js';

const PREFIX = '@nascencestudio/tapestry-menu:';
/** At most this many menus (a site has a handful). */
export const MAX_MENUS = 100;

export interface StoredMenu {
	menu: Menu;
	rev: number;
}

/** A save from an outdated copy; carries the current version. */
export class MenuConflictError extends Error {
	constructor(readonly current: StoredMenu | null) {
		super('The menu was changed elsewhere');
	}
}

const rowId = (id: string) => `${PREFIX}${id}`;

function readRow(data: string): StoredMenu | null {
	try {
		const raw = JSON.parse(data) as { rev?: unknown };
		const menu = parseMenu(raw);
		if (!menu) return null;
		const rev = typeof raw.rev === 'number' && Number.isSafeInteger(raw.rev) && raw.rev > 0 ? raw.rev : 1;
		return { menu, rev };
	} catch {
		return null;
	}
}

/** Every menu, by name. */
export async function listMenus(): Promise<StoredMenu[]> {
	// A range on the primary key instead of LIKE (no wildcards to escape).
	const rows = await SDKCoreJs.dbService.db
		.selectFrom('StudioCMSPluginData')
		.select(['id', 'data'])
		.where('id', '>=', PREFIX)
		.where('id', '<', `${PREFIX}￿`)
		.execute();
	return rows
		.map((row) => readRow(row.data))
		.filter((stored) => stored !== null)
		.sort((a, b) => a.menu.name.localeCompare(b.menu.name));
}

export async function loadMenu(id: string): Promise<StoredMenu | null> {
	if (!MENU_ID.test(id)) return null;
	const row = await SDKCoreJs.dbService.db
		.selectFrom('StudioCMSPluginData')
		.select('data')
		.where('id', '=', rowId(id))
		.executeTakeFirst();
	return row ? readRow(row.data) : null;
}

/**
 * Save a menu. `rev`: the version it was edited from (null: a new menu). Returns the saved version.
 * Throws MenuConflictError when the stored version is newer (or a new menu's id exists already).
 */
export async function saveMenu(menu: Menu, rev: number | null): Promise<StoredMenu> {
	const clean = parseMenu(menu);
	if (!clean) throw new Error('invalid menu');
	const id = rowId(clean.id);
	const saved = await SDKCoreJs.dbService.db.transaction().execute(async (trx) => {
		const existing = await trx.selectFrom('StudioCMSPluginData').select('data').where('id', '=', id).executeTakeFirst();
		const current = existing ? readRow(existing.data) : null;
		if (rev === null ? existing : !current || current.rev !== rev) throw new MenuConflictError(current);
		if (rev === null) {
			const count = await trx
				.selectFrom('StudioCMSPluginData')
				.select((eb) => eb.fn.countAll<number>().as('n'))
				.where('id', '>=', PREFIX)
				.where('id', '<', `${PREFIX}￿`)
				.executeTakeFirst();
			if (Number(count?.n ?? 0) >= MAX_MENUS) throw new Error('too many menus');
		}
		const next: StoredMenu = { menu: clean, rev: (rev ?? 0) + 1 };
		const data = JSON.stringify({ ...clean, rev: next.rev });
		if (existing) await trx.updateTable('StudioCMSPluginData').set({ data }).where('id', '=', id).execute();
		else await trx.insertInto('StudioCMSPluginData').values({ id, data }).execute();
		return next;
	});
	await runSDK(SDKCoreJs.PLUGINS.clearPluginDataCache()).catch(() => {});
	return saved;
}

export async function deleteMenu(id: string): Promise<void> {
	if (!MENU_ID.test(id)) return;
	await SDKCoreJs.dbService.db.deleteFrom('StudioCMSPluginData').where('id', '=', rowId(id)).execute();
	await runSDK(SDKCoreJs.PLUGINS.clearPluginDataCache()).catch(() => {});
}

/**
 * Plugin state (outside the menus' key range: `menus-state` sorts after `menu:\uffff`): whether the
 * default menu has been set up.
 */
const STATE_ROW = '@nascencestudio/tapestry-menus-state';
export const DEFAULT_MENU_NAME = 'Main navigation';

/**
 * Create a **Main navigation** menu once, on a site without menus (ADR 0002): called when the Menus page,
 * Navigation settings or the menu picker is used. A marker row records that it was done, so deleting
 * every menu later doesn't bring it back; a site that already has menus just gets the marker.
 */
export async function ensureDefaultMenu(): Promise<void> {
	try {
		const created = await SDKCoreJs.dbService.db.transaction().execute(async (trx) => {
			const state = await trx
				.selectFrom('StudioCMSPluginData')
				.select('id')
				.where('id', '=', STATE_ROW)
				.executeTakeFirst();
			if (state) return false;
			const existing = await trx
				.selectFrom('StudioCMSPluginData')
				.select('id')
				.where('id', '>=', PREFIX)
				.where('id', '<', `${PREFIX}\uffff`)
				.executeTakeFirst();
			if (!existing) {
				const menu: Menu = { id: newId('mn_', randomBytes), name: DEFAULT_MENU_NAME, items: [] };
				await trx
					.insertInto('StudioCMSPluginData')
					.values({ id: rowId(menu.id), data: JSON.stringify({ ...menu, rev: 1 }) })
					.execute();
			}
			await trx
				.insertInto('StudioCMSPluginData')
				.values({ id: STATE_ROW, data: JSON.stringify({ defaultMenu: true }) })
				.execute();
			return !existing;
		});
		if (created) await runSDK(SDKCoreJs.PLUGINS.clearPluginDataCache()).catch(() => {});
	} catch (error) {
		// Two first visits at once: the other one did it. Anything else: try again next time.
		console.warn('[tapestry-menus] could not set up the default menu', error);
	}
}

const REQUEST_CACHE = Symbol.for('tapestry-menus.request');

/** A menu for rendering, read once per request (a header menu and breadcrumbs share it). Null when missing. */
export function menuForRequest(locals: object, id: string): Promise<Menu | null> {
	const store = locals as Record<symbol, Map<string, Promise<Menu | null>> | undefined>;
	let cache = store[REQUEST_CACHE];
	if (!cache) {
		cache = new Map();
		store[REQUEST_CACHE] = cache;
	}
	let found = cache.get(id);
	if (!found) {
		found = loadMenu(id)
			.then((stored) => stored?.menu ?? null)
			.catch((error) => {
				console.warn('[tapestry-menus] could not load a menu', error);
				return null;
			});
		cache.set(id, found);
	}
	return found;
}
