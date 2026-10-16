/**
 * Shared bits of the plugin's endpoints: JSON responses that are never cached, the viewer's role, and
 * body reading for POSTs (same origin only, size-capped, JSON). Server only.
 */
import { hasPermission } from '@nascencestudio/tapestry';
import { getViewer } from '@nascencestudio/tapestry/page';
import type { APIContext } from 'astro';

export const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff',
		},
	});

/** Editors may look at menus; admins change them (ADR 0001). */
export async function roleOf(context: APIContext): Promise<{ editor: boolean; admin: boolean }> {
	const viewer = await getViewer(context).catch(() => null);
	const level = viewer?.isLoggedIn ? viewer.permissionLevel : 'unknown';
	return { editor: hasPermission(level, 'editor'), admin: hasPermission(level, 'admin') };
}

/** A POST body as JSON, or the response to send instead (cross-origin, too large, not JSON). */
export async function readBody(context: APIContext, maxBytes: number): Promise<unknown | Response> {
	// CSRF: the dashboard posts from the same origin; browsers always send Origin on POST.
	if (context.request.headers.get('origin') !== context.url.origin) {
		return json({ error: 'Cross-origin request refused' }, 403);
	}
	const text = await context.request.text();
	if (text.length > maxBytes) return json({ error: 'Too large' }, 413);
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return json({ error: 'Not JSON' }, 400);
	}
}
