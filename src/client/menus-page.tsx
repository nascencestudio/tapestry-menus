/**
 * The Menus page's browser side (ADR 0001): mounts the tree editor (`[data-tm-mount]`, its props as
 * JSON) and handles the "New menu" form (creates it, then opens it).
 */
import { render } from 'preact';
import { createMenu, type StoredMenu } from './api.js';
import type { Language } from './ItemForm.js';
import { MenuEditor } from './MenuEditor.js';
import { ensureStyles } from './styles.js';

interface EditorProps {
	initial: StoredMenu;
	canEdit: boolean;
	languages: Language[];
	listUrl: string;
}

export function mountMenusPage(): void {
	ensureStyles();
	const host = document.querySelector<HTMLElement>('[data-tm-mount]');
	if (host && !host.dataset.mounted) {
		host.dataset.mounted = '';
		const props = JSON.parse(host.dataset.tmMount ?? '') as EditorProps;
		render(<MenuEditor {...props} />, host);
	}

	const form = document.querySelector<HTMLFormElement>('[data-tm-create]');
	form?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const input = form.querySelector('input');
		const status = form.querySelector<HTMLElement>('[data-tm-create-status]');
		const button = form.querySelector('button');
		if (!input || !button) return;
		button.disabled = true;
		if (status) status.textContent = 'Adding…';
		try {
			const { menu } = await createMenu(input.value);
			window.location.assign(`${window.location.pathname}?menu=${encodeURIComponent(menu.id)}`);
		} catch (error) {
			if (status) {
				status.dataset.kind = 'error';
				status.textContent = `Not added: ${(error as Error).message}`;
			}
			button.disabled = false;
		}
	});
}
