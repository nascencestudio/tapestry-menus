# Devlog

Short log of this repository's sessions, newest first. The project-wide devlog (all sessions) is
in [tapestry-playground](https://github.com/nascencestudio/tapestry-playground/blob/main/docs/devlog.md).

---

## 2026-10-16: "Show in navigation" hidden; a default menu

**Request:** StudioCMS's "Show in navigation" (Basic Information) is confusing next to menus. Checked:
only `frontendNavigation()` reads it (a flat Markdown list for StudioCMS themes); nothing on our sites.
The user chose to hide it on every page form and add a visible notice, and a default **Main navigation**
created once. [ADR 0002](decisions/0002-show-in-navigation-and-default-menu.md). `nav-notice.ts` (pure,
4 tests) + middleware; `ensureDefaultMenu()` with a marker row. Verified on a fresh scratch site (second
dev server on port 4500, deleted afterwards): the default menu appears; on the dev site (menus exist)
only the marker was added.

---

## 2026-10-16: Menu settings in the sidebar

**Request:** no menu button in the editor's purple bar; menu settings in the right sidebar under the
component settings, like Drupal. `MenuSettings.tsx` (Provide a menu link, title, parent item across
menus, description, Save menu link) replaces the dialog, mounted by Tapestry's new panel companions
(Tapestry ADR 0042). `plan.ts` decides which menus to save (moving a link between menus takes its
children; the new menu is saved first); 6 unit tests. Playground `menus` and `a11y` suites updated.
Then renamed **Navigation settings** (not to be confused with a selected Menu component's settings).

---

## 2026-10-16: First version

**Request:** Drupal-like menus for StudioCMS: several menus edited in the dashboard, shown as
components in pages and templates, CSS-safe classes from the labels, a target per item, breadcrumbs,
visibility by login, menu blocks with depth, one menu whose links follow the language, its own
Menus page (admins edit, editors view), no drafts, and menu settings in the page editor.
[ADR 0001](decisions/0001-tapestry-menus.md).

### Done
- Model (`menus.ts`): validation, class names, the visible tree with the active trail, start level and
  depth, breadcrumbs, tree operations and drops. 28 unit tests.
- Store (plugin data rows with revisions; outdated saves refused), endpoints, `getMenu()`,
  `<Menu>`, `<Breadcrumbs>`, `menuComponents()`.
- Menus dashboard page (tree editor with drag and drop and keyboard buttons, item settings) and the
  page editor's Menu dialog.
- Tapestry 0.6.0 hooks used: `optionsUrl`, `resolveSiteLinks()`, `pageLanguage()`,
  `inEditorCanvas()`, `@nascencestudio/tapestry/links`, the companion button.
- Playground: `menus` e2e suite (7 steps), menu states in the a11y suite (both themes).

### Learned
- Pragmatic DnD's `dragHandle` drops drags that leave a small handle before `dragstart`; drag rows.
- An insertion with Python `replace` matched inside a longer selector and broke two CSS rules (all
  labels struck through): check the first match is the one meant.

### Next
- Release Tapestry 0.5.0 and 0.6.0, then create the GitHub repo, the first release (token), and
  switch the playground to npm versions.
