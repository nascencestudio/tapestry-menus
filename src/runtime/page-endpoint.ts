/// <reference types="studiocms/v/types" />
/// <reference path="../virtual.d.ts" />
/**
 * `/_menus/page?id=<page id>` (editors): what the page editor's Menu settings need (ADR 0001): the page
 * (title, path) and every menu, so it can show where the page is linked. Changes are saved through
 * `/_menus/menus` like the dashboard's (admins only, refused when the menu changed meanwhile).
 */
import { runSDK, SDKCoreJs } from 'studiocms:sdk';
import config from 'virtual:tapestry/config';
import { pagePath } from '@nascencestudio/tapestry';
import type { APIRoute } from 'astro';
import { json, roleOf } from './http.js';
import { listMenus } from './menus-store.js';

export const prerender = false;

const PAGE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const GET: APIRoute = async (context) => {
	const role = await roleOf(context);
	if (!role.editor) return json({ error: 'Editors only' }, 403);
	const id = context.url.searchParams.get('id') ?? '';
	if (!PAGE_ID.test(id)) return json({ error: 'No such page' }, 404);
	try {
		const page = (await runSDK(SDKCoreJs.GET.page.byId(id))) as unknown as
			| { id: string; title?: string | null; slug: string }
			| undefined;
		if (!page) return json({ error: 'No such page' }, 404);
		return json({
			page: {
				id: String(page.id),
				title: String(page.title ?? ''),
				path: pagePath(config.pageUrlPattern, String(page.slug)),
			},
			menus: await listMenus(),
			canEdit: role.admin,
		});
	} catch (error) {
		console.error('[tapestry-menus] reading menus failed', error);
		return json({ error: 'Reading menus failed' }, 500);
	}
};
