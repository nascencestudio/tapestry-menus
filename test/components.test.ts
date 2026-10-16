import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BREADCRUMBS_TYPE, MENU_TYPE, menuComponents } from '../src/components.js';
import { OPTIONS_ROUTE } from '../src/routes.js';

describe('menuComponents', () => {
	it('defines Menu and Breadcrumbs with a menu picker and a library icon', () => {
		const definitions = menuComponents();
		expect(definitions.map((d) => d.type)).toEqual([MENU_TYPE, BREADCRUMBS_TYPE]);
		for (const definition of definitions) {
			expect(definition.props?.menu).toMatchObject({ type: 'select', optionsUrl: OPTIONS_ROUTE });
			expect(definition.thumbnail).toMatch(/\.svg$/);
			expect(existsSync(fileURLToPath(definition.thumbnail as string))).toBe(true);
			expect(definition.category).toBe('Navigation');
		}
		expect(menuComponents({ category: 'Site' })[0]?.category).toBe('Site');
	});
});
