/**
 * `@nascencestudio/tapestry-menus/components`: Menu and Breadcrumbs for Tapestry's component library
 * (ADR 0001), so menus can be placed in pages, templates, headers and footers. Their menu is chosen
 * from the site's menus (a select filled from `/_menus/options`, Tapestry ADR 0042).
 *
 * @example
 * ```js
 * // studiocms.config.mjs
 * import { menuComponents } from '@nascencestudio/tapestry-menus/components';
 * tapestry({ components: [...components, ...menuComponents()] })
 * ```
 */
import { type ComponentDefinition, defineComponent } from '@nascencestudio/tapestry';
import { LIMITS } from './menus.js';
import { OPTIONS_ROUTE } from './routes.js';

export const MENU_TYPE = 'tapestry-menu';
export const BREADCRUMBS_TYPE = 'tapestry-breadcrumbs';

export interface MenuComponentsOptions {
	/** The library category. Default "Navigation". */
	category?: string;
}

const file = (path: string) => new URL(path, import.meta.url).href;

const menuProp = {
	type: 'select',
	label: 'Menu',
	description: 'Menus are edited in Dashboard → Menus.',
	options: [],
	optionsUrl: OPTIONS_ROUTE,
} as const;

export function menuComponents(options: MenuComponentsOptions = {}): ComponentDefinition[] {
	const category = options.category ?? 'Navigation';
	return [
		defineComponent({
			type: MENU_TYPE,
			label: 'Menu',
			description: 'One of the site’s menus, as links (all levels, or a part).',
			category,
			component: file('./runtime/Menu.astro'),
			props: {
				menu: menuProp,
				startLevel: {
					type: 'number',
					label: 'Start at level',
					description: '1: the whole menu. 2: the pages under the current top-level item, and so on.',
					default: 1,
					min: 1,
					max: LIMITS.depth,
				},
				maxDepth: {
					type: 'number',
					label: 'Levels to show',
					description: '0: all of them.',
					default: 0,
					min: 0,
					max: LIMITS.depth,
				},
				label: {
					type: 'text',
					label: 'Name for screen readers',
					description: 'Default: the menu’s name.',
					maxLength: 80,
				},
			},
		}),
		defineComponent({
			type: BREADCRUMBS_TYPE,
			label: 'Breadcrumbs',
			description: 'Where the current page is in a menu (Home › About › Team).',
			category,
			component: file('./runtime/Breadcrumbs.astro'),
			props: {
				menu: menuProp,
				homeLabel: {
					type: 'text',
					label: 'Home link',
					description: 'Text for a first link to the home page. Empty: no home link.',
					default: 'Home',
					maxLength: 80,
				},
			},
		}),
	];
}
