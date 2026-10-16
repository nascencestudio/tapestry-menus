/**
 * The Menus page's and the Menu settings panel's requests (browser). Errors carry the server's message; a
 * save from an outdated copy rejects with `MenuConflict` holding the current version.
 */
import type { Menu } from '../menus.js';
import { MENUS_ROUTE, PAGES_ROUTE } from '../routes.js';

export interface StoredMenu {
	menu: Menu;
	rev: number;
}

export interface LinkablePage {
	id: string;
	title: string;
	path: string;
	draft: boolean;
}

export class MenuConflict extends Error {
	constructor(
		message: string,
		readonly current: StoredMenu | null,
	) {
		super(message);
	}
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
	});
	const body = (await response.json().catch(() => null)) as (T & { error?: string; current?: StoredMenu }) | null;
	if (response.status === 409) throw new MenuConflict(body?.error ?? 'Changed elsewhere', body?.current ?? null);
	if (!response.ok || !body) throw new Error(body?.error ?? response.statusText);
	return body;
}

const post = <T>(body: unknown) => request<T>(MENUS_ROUTE, { method: 'POST', body: JSON.stringify(body) });

export const createMenu = (name: string) => post<StoredMenu>({ action: 'create', name });
export const saveMenu = (menu: Menu, rev: number) => post<StoredMenu>({ action: 'save', menu, rev });
export const deleteMenu = (id: string) => post<{ deleted: string }>({ action: 'delete', id });

let pages: Promise<LinkablePage[]> | null = null;

/** The site's pages (Tapestry's link picker list), loaded once. */
export function loadPages(): Promise<LinkablePage[]> {
	pages ??= request<{ pages: LinkablePage[] }>(PAGES_ROUTE)
		.then((body) => body.pages)
		.catch((error) => {
			pages = null;
			throw error;
		});
	return pages;
}

/** A random id (`mi_…`), as the server makes them. */
export function randomItemId(): string {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
	return `mi_${[...crypto.getRandomValues(new Uint8Array(12))].map((b) => alphabet[b % 36]).join('')}`;
}
