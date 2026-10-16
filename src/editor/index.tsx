/**
 * `@nascencestudio/tapestry-menus/editor`: opens the page editor's Menu dialog (ADR 0001). Tapestry's
 * editor loads this on demand when tapestry-menus is installed (Tapestry ADR 0042) and calls
 * `openMenuEditor()` from its Menu button.
 */
import { render } from 'preact';
import { ensureStyles } from '../client/styles.js';
import { PAGE_ROUTE } from '../routes.js';
import { MenuDialog } from './MenuDialog.js';

export interface MenuEditorOptions {
	/** The StudioCMS page id. */
	pageId: string;
	/** Passed by Tapestry to every companion (the media picker); not used here. */
	loadPicker?: unknown;
	/** The page endpoint. Default `/_menus/page`. */
	endpoint?: string;
}

/** Open the dialog; resolves when it closes. */
export function openMenuEditor(options: MenuEditorOptions): Promise<void> {
	ensureStyles();
	return new Promise((resolve) => {
		const host = document.createElement('div');
		host.dataset.tapestryMenusEditorHost = '';
		document.body.append(host);
		const close = () => {
			render(null, host);
			host.remove();
			resolve();
		};
		render(<MenuDialog pageId={options.pageId} endpoint={options.endpoint ?? PAGE_ROUTE} onClose={close} />, host);
	});
}
