# 0001. Tapestry Menus: menus edited in the dashboard, Menu and Breadcrumbs components

- Status: Accepted (the user's decisions, 2026-10-13 and 2026-10-15). First version built 2026-10-16.
- Date: 2026-10-16

## Context

StudioCMS has no menus: no way to keep several menus (main navigation, footer links, a sidebar) and
edit them in the dashboard. The user wanted what Drupal's menu system gives: any number of menus,
nested links to pages, edited without touching code, and shown in templates, headers and footers.
No StudioCMS plugin does this.

## Decision

1. **A companion plugin tied to Tapestry**, `@nascencestudio/tapestry-menus`: it `requires` the
   Tapestry plugin and builds on its hooks (Tapestry ADR 0042): `select` props filled from a URL,
   `resolveSiteLinks()` for links, `pageLanguage()`, `inEditorCanvas()`, the link validation from
   `@nascencestudio/tapestry/links`, and the companion button in the page editor.
2. **Data: one row per menu** in StudioCMS's plugin data table (`@nascencestudio/tapestry-menu:<mn_…>`),
   a tree of items, re-validated on every read and every save (`parseMenu`): ids of a fixed shape,
   one-line labels and descriptions with length limits, links in Tapestry's canonical form (a page id
   or a safe web address: relative, http(s), mailto, tel), at most 6 levels and 300 items, unknown
   keys dropped. A save counts revisions; a save from an outdated copy is refused (409) instead of
   undoing someone else's change.
3. **Links follow pages.** A page link stores the page id, so it follows renames. It shows the
   page's current path in the visitor's language, and is left out (with its children) while the page
   isn't visible: unpublished, a StudioCMS draft, deleted, or without a version in the page's
   language. That's the user's "one menu, links follow the language". Labels can be translated per
   language; empty means the default label.
4. **Per-item options** (the user's list): link target ("open in a new tab", with `noopener
   noreferrer`), a description (the link's title), extra CSS classes (valid identifiers only), who
   sees it (everyone, logged in, logged out), and shown or hidden.
5. **Rendering: data plus an unstyled default.** `getMenu()` / `getBreadcrumbs()` return the visible
   tree (with `current` and `inTrail`) for your own markup. `<Menu>` writes nested lists in a `<nav>`,
   and `<Breadcrumbs>` an ordered list. Both are unstyled and use **CSS-safe classes from the labels**
   (the user's request): `menu menu--main-navigation`, `menu__item menu__item--about`, plus `--current`,
   `--trail` and `--has-children`. Menu blocks take a start level (2: the current section's pages) and
   a depth. They ship no JavaScript.
6. **Menus are components** (the user's request), so they can go in pages, templates, headers and
   footers: `menuComponents()` adds Menu and Breadcrumbs to Tapestry's library, with the menu chosen
   from a list loaded from `/_menus/options`. In the editor's canvas, a block without a menu (or with
   nothing to show) explains why. Visitors get nothing.
7. **Dashboard → Menus**, its own sidebar item after Template Management (plugins are listed in config
   order). It's a double-sidebar page: All menus, then each menu. **Admins edit; editors view** (StudioCMS
   lists only editor-level plugin pages in the Dashboard section). The endpoints check this again.
   The tree editor reorders and nests items by drag and drop, with buttons for keyboards (move up and
   down, in and out, add under, remove); the item's settings are shown beside the tree. **No drafts:
   saving makes a menu live.**
8. **Menu settings in the page editor** (the user's "yes, in the first version"), like Drupal's node
   sidebar: a **Menu settings** section under Tapestry's settings panel (Tapestry ADR 0042's panel
   companions; first built as a Menu button with a dialog, moved there at the user's request on
   2026-10-16). "Provide a menu link", the link's title, its parent item (each menu's top level or any
   item, in one list) and a description; **Save menu link** applies it at once (live, not part of the
   page's draft), moving the link with its children when it changes menu. When a page is linked more
   than once, the first link is edited there and the others are listed. Editors see where it's linked.
9. **Security:** the JSON endpoints are editors-only to read and admins-only to change, same origin
   for POSTs, 512 KB at most, and never cached. Menu data is shown as text (Astro escapes it). Links
   go through the same URL check as Tapestry's link props, and classes are filtered to identifiers.

## Dependencies (review)

At runtime in the browser (the Menus page and the Menu settings panel only; public pages get none):

| Package | Version | Unpacked (npm) | Provenance | Dependencies | Note |
| --- | --- | --- | --- | --- | --- |
| preact | 10.29.8 | 1.56 MB | yes | none | Tapestry's version (Tapestry ADR 0002); pnpm keeps one copy |
| @atlaskit/pragmatic-drag-and-drop | 4.0.0 | 486 KB | no | `@babel/runtime`, `bind-event-listener`, `raf-schd` | Tapestry's version (Tapestry ADR 0007) |
| @atlaskit/pragmatic-drag-and-drop-hitbox | 3.0.0 | 399 KB | no | `@babel/runtime`, the package above | its `tree-item` hitbox (Tapestry uses `list-item`) |

All three are already in every Tapestry site at the same versions (one copy each in the playground).
Bundled sizes: the Menus page ~22 KB gzipped, the Menu settings panel ~11 KB including Preact (shared with Tapestry's editor when deduplicated). The Atlassian
packages have no npm provenance. Tapestry ADR 0007 accepted that with mitigations, which apply here too:
the release-age gate, exact pins, a tiny transitive tree, and the `trustPolicy` check in
`pnpm-workspace.yaml`.

## Alternatives considered

- **Menus inside Tapestry:** the user preferred a separate plugin, like SEO, so sites without menus
  don't carry it.
- **Drafts and publishing for menus:** offered; the user chose "saving makes it live".
- **One menu per language:** offered; the user chose one menu whose links follow the language.
- **A handle-only drag (`dragHandle`):** Pragmatic DnD then ignores drags that leave the handle
  before the drag starts (the browser fires `dragstart` after a few pixels of movement, by which time
  the pointer can be off a small handle). Whole rows are dragged instead, like Tapestry's layer tree.

## Consequences

- Needs Tapestry ≥ 0.6.0 (the hooks in Tapestry ADR 0042), listed before this plugin.
- The active trail in the editor's canvas is right on the first load. Re-renders of a menu block
  from the render endpoint don't know the page's address, so nothing is marked current there.
- The first npm release needs a one-time token (trusted publishing can only be set up once the
  package exists).
