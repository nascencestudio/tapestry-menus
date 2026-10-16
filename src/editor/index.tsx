/**
 * `@nascencestudio/tapestry-menus/editor`: the page editor's **Menu settings** panel (ADR 0001).
 * Tapestry loads this on demand when tapestry-menus is installed and calls `mountMenuSettings()` the
 * first time its Menu settings section (under the settings panel) is opened (Tapestry ADR 0042).
 */
import { render } from 'preact';
import { ensureStyles } from '../client/styles.js';
import { PAGE_ROUTE } from '../routes.js';
import { MenuSettings } from './MenuSettings.js';

export interface MenuSettingsOptions {
	/** The StudioCMS page id. */
	pageId: string;
	/** Passed by Tapestry to every companion (the media picker); not used here. */
	loadPicker?: unknown;
	/** The page endpoint. Default `/_menus/page`. */
	endpoint?: string;
}

/** Fill `element` with the page's menu settings; returns a cleanup. */
export function mountMenuSettings(element: HTMLElement, options: MenuSettingsOptions): () => void {
	ensureStyles();
	render(<MenuSettings pageId={options.pageId} endpoint={options.endpoint ?? PAGE_ROUTE} />, element);
	return () => render(null, element);
}
