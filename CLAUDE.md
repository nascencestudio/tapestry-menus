# CLAUDE.md: @nascencestudio/tapestry-menus

The source of truth for anyone (human or AI) working in this repo. Read it at the start of every
session and keep it current.

## What it is

Menus for Tapestry sites on StudioCMS ([ADR 0001](docs/decisions/0001-tapestry-menus.md)): any number
of menus (trees of links to pages or web addresses) edited in Dashboard → Menus, `<Menu>` and
`<Breadcrumbs>` (unstyled, CSS-safe classes from the labels), Menu and Breadcrumbs components for
Tapestry's library, and Menu settings under the settings panel of Tapestry's page editor. Requires the Tapestry plugin
(≥ 0.6.0: the hooks in Tapestry ADR 0042). Nascence Studio, MIT.

Sibling checkouts in `/Volumes/T7/www/`: `tapestry/`, `medialibrary/`, `tapestry-seo/`,
`tapestry-playground/` (dev site and browser tests: `e2e/menus.e2e.mjs`, menu states in
`e2e/a11y.e2e.mjs`), and this repo. The devlog of record for the whole project is the playground's;
this repo has its own short one.

## Status

- First version built 2026-10-16 (0.1.0, not on GitHub or npm yet). Develops against Tapestry from
  `file:../tapestry` (branch `companion-hooks`, 0.6.0 unreleased); switch to the npm version once
  it's out. The first npm release needs a one-time token (trusted publishing needs the package to exist).

## Rules

1. **Security first.** pnpm only (never npm/npx/yarn; `pnpm view`). Hardening in `pnpm-workspace.yaml`
   with written reasons. Pin exact versions. New dependencies need a reviewed ADR (ADR 0001 covers
   preact and Pragmatic DnD). `pnpm audit` must pass. No Meta libraries.
2. **Untrusted input:** every menu read or received goes through `parseMenu()` (links through
   Tapestry's `cleanLinkValue()`); POSTs are same-origin, size-limited, admins only; reads editors only.
3. **Document everything:** devlog entry each session; decisions as ADRs (`docs/decisions`, 0001+).
4. **Tests with every change**; adversarial for the model. UI changes: keep the playground's `menus`
   and `a11y` suites passing.

## Layout

```
src/
├── index.ts          ← plugin: routes, optimizeDeps, the Menus dashboard page (after Template Management)
├── menus.ts          ← model (pure, browser-safe): parseMenu, classSlug, renderMenu, trail, tree ops, applyDrop
├── components.ts     ← `/components` export: menuComponents() (tapestry-menu, tapestry-breadcrumbs)
├── routes.ts         ← /_menus/menus, /_menus/options, /_menus/page (+ Tapestry's /_tapestry/pages)
├── virtual.d.ts      ← Tapestry's virtual:tapestry/config
├── client/           ← browser: api.ts, MenuEditor.tsx (tree, DnD, keyboard), ItemForm.tsx, menus-page.tsx
│                        (mount + create form), icons.tsx, styles.ts (CSS string, also rendered server-side)
├── editor/           ← `/editor` export: mountMenuSettings() + MenuSettings.tsx (Tapestry's panel companion),
│                        plan.ts (pure: placements, form defaults, which menus to save)
└── runtime/          ← menus-store.ts (plugin data rows, revisions, per-request cache), menus.ts (`/menus`:
                         getMenu, getBreadcrumbs), Menu.astro + MenuList.astro, Breadcrumbs.astro,
                         MenusNav.astro + MenusPage.astro (dashboard), endpoints, http.ts
```

## Commands

| Command | |
| --- | --- |
| `pnpm install` | Install |
| `pnpm build` / `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm audit` | |
| Release | Bump `version`, PR, merge, GitHub release `v<version>`, approve the staged version on npm. Never publish locally. |

## Gotchas

- The model (`menus.ts`) runs in the browser too: import link validation from
  `@nascencestudio/tapestry/links`, never from `@nascencestudio/tapestry` (the server-side plugin).
- StudioCMS names the dashboard page's URL from the identifier with `_` for every `-` and `/`:
  `/dashboard/nascencestudio_tapestry_menus/menus`.
- Every entry of the inner sidebar shares one path (`?menu=`), so the active link is decided here
  (StudioCMS's `SidebarLink` matches on path only).
- Drag whole rows, not a small handle: with `dragHandle`, Pragmatic DnD ignores drags whose pointer has
  left the handle when the browser fires `dragstart` (a few pixels in). The tree-item hitbox needs a
  full-width drop target with the indent as padding (`currentLevel × indentPerLevel` from its left edge).
- The tree editor warns before leaving with unsaved changes (`beforeunload`). Headless Chrome then
  blocks navigation silently: e2e accepts `Page.javascriptDialogOpening`.
- Dev pages carry `data-astro-source-*` attributes on every element: strip them before matching
  rendered HTML in tests.
- Inline `style` in the canvas placeholders is component code, not content (content can't add styles).
- Row and tool buttons: no `aria-label` that differs from the visible text (axe
  `label-content-name-mismatch`); the level is visually hidden text inside the button.
- `usePluginData()` can't save in StudioCMS 0.6.1: the store uses `SDKCoreJs.dbService.db`.
- Menu settings render **inside** StudioCMS's page form (Tapestry's sidebar): no `name` attributes,
  `form="tapestry-detached"` on inputs, `type="button"`, Enter suppressed; else Save submits the page.
