# 0002. StudioCMS's "Show in navigation": hidden, with a notice; a default Main navigation menu

- Status: Accepted (the user's decisions, 2026-10-16)
- Date: 2026-10-16

## Context

StudioCMS's page create and edit forms (Basic Information) have a "Show in navigation" yes/no field.
It suggests StudioCMS has a navigation, and that it competes with Tapestry Menus; the user found it
confusing. In StudioCMS 0.6.1 the flag (`showOnNav`) is read only by `frontendNavigation()`: a flat
list of pages of one type (Markdown by default), newest first, for StudioCMS's ready-made themes.
Nothing in StudioCMS's dashboard or a Tapestry site uses it (details in the playground's
docs/research/studiocms-internals.md).

## Decision

1. **Don't build on it.** A flat, date-ordered, single-page-type list can't be a menu (no nesting,
   order, labels or languages), and a second way to put a page "in the navigation" next to Navigation
   settings would be exactly the confusion to remove.
2. **Hide the field** on both forms, for every page type, when tapestry-menus is installed, and **end
   the Basic Information tab with a notice** (an icon, "Site navigation is managed by Tapestry Menus", a
   link to Dashboard → Menus and a pointer to Navigation settings on Tapestry pages) (the user's hybrid
   choice). Done by the plugin's middleware on the HTML StudioCMS sends for `/<dashboard>/content-management/create|edit`:
   one CSS rule (the field's row, found by its hidden `select#show-in-nav`) in the `<head>`, and the
   notice before the tab's closing tag. No StudioCMS patch: if StudioCMS changes its markup, nothing is
   injected (or the rule matches nothing) and the field shows again. The stored flag isn't changed (the
   hidden select still submits it).
3. **A default menu**: the first time the Menus page, Navigation settings or the menu picker is used on
   a site with no menus, tapestry-menus creates **Main navigation** (empty). A marker row
   (`@nascencestudio/tapestry-menus-state`, outside the menus' key range) records that this was done,
   so deleting every menu later doesn't bring it back; a site that already has menus just gets the marker.

## Consequences

- One more middleware on dashboard page responses (only those two paths are read and rewritten).
- Sites using a StudioCMS theme that reads `frontendNavigation()` lose the field with this plugin: they'd
  use `<Menu>` instead.
- Checked in the playground's `menus` suite (both forms; on a fresh site, the default menu) and the
  a11y suite (the notice).
