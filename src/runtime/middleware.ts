/**
 * Astro middleware added by the plugin: on the dashboard's page create and edit forms, hides
 * StudioCMS's "Show in navigation" field and adds a notice that Tapestry Menus manages navigation
 * (ADR 0002, `nav-notice.ts`). Every other response passes through untouched.
 */
import type { MiddlewareHandler } from 'astro';
import { CONTENT_FORM, injectNavNotice } from '../nav-notice.js';
import { MENUS_PAGE } from '../routes.js';

export const onRequest: MiddlewareHandler = async (context, next) => {
	const response = await next();
	if (!CONTENT_FORM.test(context.url.pathname) || context.request.method !== 'GET' || response.status !== 200)
		return response;
	if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response;
	const base = context.url.pathname.split('/')[1] ?? 'dashboard';
	const html = injectNavNotice(await response.text(), `/${base}/${MENUS_PAGE}`);
	const headers = new Headers(response.headers);
	headers.delete('content-length');
	return new Response(html, { status: response.status, statusText: response.statusText, headers });
};
