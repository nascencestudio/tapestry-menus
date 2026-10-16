/**
 * @nascencestudio/tapestry-menus: menus for Tapestry sites on StudioCMS (ADR 0001).
 * - Dashboard → **Menus** (after Template Management): any number of menus, each a tree of links to
 *   pages or web addresses, edited by admins with drag and drop (editors can look). Saving makes a
 *   menu live.
 * - `<Menu>` and `<Breadcrumbs>` (`@nascencestudio/tapestry-menus/Menu.astro`, `/Breadcrumbs.astro`),
 *   unstyled, with CSS-safe classes from the labels; `getMenu()` (`/menus`) for your own markup.
 * - Menu and Breadcrumbs components for Tapestry's library (`menuComponents()` from `/components`).
 * - A **Menu** button in Tapestry's page editor: where this page is linked; admins add it to a menu.
 * Requires Tapestry (`@nascencestudio/tapestry` 0.6 or later), listed before this plugin.
 */
import { fileURLToPath } from 'node:url';
import { definePlugin } from 'studiocms/plugins';
import { MENUS_ROUTE, OPTIONS_ROUTE, PAGE_ROUTE } from './routes.js';

export type { Menu, MenuItem, RenderItem, Visibility } from './menus.js';
export { classSlug, LIMITS, menuClasses, parseMenu, renderMenu, trail } from './menus.js';
export { MENUS_ROUTE, OPTIONS_ROUTE, PAGE_ROUTE } from './routes.js';

const PACKAGE_NAME = '@nascencestudio/tapestry-menus';
const TAPESTRY = '@nascencestudio/tapestry';

export type TapestryMenusPlugin = ReturnType<typeof definePlugin>;

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Browser dependencies of the Menus page, pre-bundled by Vite in dev (else the first visit reloads the
 * page). `>` resolves them from this package.
 */
const BROWSER_DEPS = [
	'preact',
	'preact/hooks',
	'preact/jsx-runtime',
	'@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter',
	'@atlaskit/pragmatic-drag-and-drop/utils/combine',
	'@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item/attach-instruction',
	'@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item/extract-instruction',
].map((dep) => `${PACKAGE_NAME} > ${dep}`);

/**
 * The Tapestry Menus plugin.
 *
 * @example
 * ```js
 * // studiocms.config.mjs
 * import tapestry from '@nascencestudio/tapestry';
 * import tapestryMenus from '@nascencestudio/tapestry-menus';
 * import { menuComponents } from '@nascencestudio/tapestry-menus/components';
 * export default defineStudioCMSConfig({
 *   plugins: [tapestry({ components: [...components, ...menuComponents()] }), tapestryMenus()],
 * });
 * ```
 */
export function tapestryMenus(): TapestryMenusPlugin {
	return definePlugin({
		identifier: PACKAGE_NAME,
		name: 'Tapestry Menus',
		requires: [TAPESTRY],
		hooks: {
			'studiocms:astro-config': ({ addIntegrations }) => {
				addIntegrations({
					name: PACKAGE_NAME,
					hooks: {
						'astro:config:setup': ({ injectRoute, updateConfig }) => {
							const routes: Array<[string, string]> = [
								[MENUS_ROUTE, './runtime/menus-endpoint.js'],
								[OPTIONS_ROUTE, './runtime/options-endpoint.js'],
								[PAGE_ROUTE, './runtime/page-endpoint.js'],
							];
							for (const [pattern, entrypoint] of routes) {
								injectRoute({ pattern, entrypoint: resolve(entrypoint), prerender: false });
							}
							updateConfig({ vite: { optimizeDeps: { include: BROWSER_DEPS } } });
						},
					},
				});
			},
			'studiocms:dashboard': ({ setDashboard }) => {
				setDashboard({
					translations: { en: {} },
					// In the Dashboard section after Tapestry's Template Management (plugins are listed in config
					// order). StudioCMS lists only editor-level pages there: editors look, admins change.
					dashboardPages: {
						user: [
							{
								title: { en: 'Menus' },
								description: 'Site navigation: menus and their links.',
								route: 'menus',
								icon: 'heroicons:bars-3',
								sidebar: 'double',
								requiredPermissions: 'editor',
								innerSidebarComponent: resolve('./runtime/MenusNav.astro'),
								pageBodyComponent: resolve('./runtime/MenusPage.astro'),
							},
						],
					},
				});
			},
		},
	});
}

export default tapestryMenus;
