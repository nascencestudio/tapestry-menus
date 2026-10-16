# @nascencestudio/tapestry-menus

**Menus for [Tapestry](https://github.com/nascencestudio/tapestry) sites on [StudioCMS](https://studiocms.dev):**
as many menus as you need (main navigation, footer links, a sidebar), edited in the dashboard, and
shown with Menu and Breadcrumbs components in pages, templates, headers and footers.

- **Dashboard → Menus:** each menu is a tree of links, up to six levels deep. Drag items to reorder
  or nest them, or use the buttons on the selected item from the keyboard. Saving makes a menu live.
  Admins edit; editors can look.
- **Links follow your pages:** a link to a page keeps working when the page's address changes, goes
  to the page in the visitor's language, and disappears (with the items under it) while the page
  isn't published. Web addresses (https, relative, mailto, tel) work too.
- **Per item:** open in a new tab, a description (shown on hover), extra CSS classes, who sees it
  (everyone, only logged-in people, only people who aren't logged in), shown or hidden, and labels
  in your other languages.
- **Components:** Menu (the whole menu, or one part: "start at level 2" shows the current section's
  pages; "levels to show" limits the depth) and Breadcrumbs (Home › About › Team), in Tapestry's
  component library.
- **In the page editor:** a **Menu** button shows where the page is linked. Admins can add it to a
  menu there, or rename, move and remove its entries.
- **Unstyled, with predictable classes:** class names come from the labels, so you can style one
  menu or one item: `menu menu--main-navigation`, `menu__item menu__item--about`, plus
  `menu__item--current`, `menu__item--trail` and `menu__item--has-children`. No JavaScript reaches
  your visitors.

## Requirements

- Node ≥ 22.12, Astro 7, StudioCMS 0.6, Tapestry ≥ 0.6

## Install

```sh
pnpm add @nascencestudio/tapestry-menus
```

```js
// studiocms.config.mjs
import tapestry, { tapestryComponentRegistry } from '@nascencestudio/tapestry';
import tapestryMenus from '@nascencestudio/tapestry-menus';
import { menuComponents } from '@nascencestudio/tapestry-menus/components';
import { defineStudioCMSConfig } from 'studiocms/config';
import { components } from './src/tapestry.config.mjs';

export default defineStudioCMSConfig({
  componentRegistry: { ...tapestryComponentRegistry() },
  plugins: [
    // Menu and Breadcrumbs join your components in the editor's library.
    tapestry({ components: [...components, ...menuComponents()] }),
    // After Tapestry: the Menus page then follows Template Management in the sidebar.
    tapestryMenus(),
  ],
});
```

Page routes must load pages with Tapestry's `getPage()` (as Tapestry's setup describes), so menus
know the page's language and who is viewing.

## Use

1. **Dashboard → Menus**, add a menu (admins), then add items: a label and a page, a web address or
   no link (a heading for the items under it). Save.
2. **Show it:** add a **Menu** component in a page, a template, or a header or footer
   (Dashboard → Template Management) and choose the menu in its settings. Or put it in your layout:

```astro
---
import Menu from '@nascencestudio/tapestry-menus/Menu.astro';
import Breadcrumbs from '@nascencestudio/tapestry-menus/Breadcrumbs.astro';
---
<Menu menu="mn_…" />                      <!-- the menu's id is shown on its page -->
<Menu menu="mn_…" startLevel={2} />       <!-- the current section's pages -->
<Breadcrumbs menu="mn_…" homeLabel="Home" />
```

3. **Style it** with the classes above, e.g. a horizontal top level:

```css
.menu--main-navigation .menu__list--level-1 { display: flex; gap: 1rem; list-style: none; }
.menu__item--current > .menu__link { font-weight: 600; }
```

**Your own markup:** `getMenu(Astro, id, { startLevel, maxDepth })` and `getBreadcrumbs(Astro, id)`
from `@nascencestudio/tapestry-menus/menus` return what the viewer may see, with `href`, `label`,
`newTab`, `rel`, `classes`, `current`, `inTrail` and `children` per item.

## How it's built

Tapestry Menus is developed with an AI coding assistant (Anthropic's Claude), directed by its
maintainer at Nascence Studio, who sets the requirements, makes the decisions and checks the
results. Commits written with its help say so (`Co-Authored-By`).

What keeps that accountable:

- **Decisions are written down** in [docs/decisions](docs/decisions/), and each working session is
  recorded in the [devlog](docs/devlog.md).
- **Behaviour is tested.** Unit tests cover the menu model with adversarial input (unsafe addresses,
  hostile class names, oversized and too-deep trees, duplicate ids), the visible tree (login,
  hidden items, unpublished pages, the active trail, levels) and every tree move. Browser tests in
  [tapestry-playground](https://github.com/nascencestudio/tapestry-playground) drive the Menus page,
  drag and drop, the page editor's dialog and what visitors get, including an accessibility audit.
- **Everything is validated again on the server**, and only admins can change menus.
- **Releases are traceable.** Versions are published from GitHub Actions with npm provenance, and
  each one is approved by a person with two-factor authentication.

Found a problem? Please [open an issue](https://github.com/nascencestudio/tapestry-menus/issues).

## License

MIT © Nascence Studio
