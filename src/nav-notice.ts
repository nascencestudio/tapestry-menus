/**
 * StudioCMS's "Show in navigation" field (ADR 0002): a flag only StudioCMS's ready-made themes read
 * (`frontendNavigation()`: a flat list of Markdown pages by date). With Tapestry Menus it does nothing
 * and suggests a navigation that isn't there, so the page create and edit forms hide it, and their
 * Basic Information tab ends with a notice pointing to Navigation settings and Dashboard → Menus.
 * Done on the HTML StudioCMS sends (no patch): if StudioCMS changes its markup, the field simply shows
 * again. Pure.
 */

/** The dashboard's page create and edit forms (any dashboard base path). */
export const CONTENT_FORM = /^\/[^/]+\/content-management\/(create|edit)\/?$/;

/** The field's row: the one holding StudioCMS's hidden `<select id="show-in-nav">`. */
const HIDE_CSS = '.form-row-item:has(> sui-select > select#show-in-nav){display:none}';

const NOTICE_CSS = `
.tapestry-menus-notice{display:flex;gap:.75rem;align-items:flex-start;margin:1.5rem 0 .5rem;padding:.875rem 1rem;color:var(--text-normal);background:var(--background-step-2);border:1px solid var(--border);border-left:4px solid var(--primary-base);border-radius:var(--radius-md,.5rem);font-size:.9375rem;line-height:1.45}
.tapestry-menus-notice svg{flex:none;width:1.5rem;height:1.5rem;color:var(--primary-base)}
.tapestry-menus-notice p{margin:0}
.tapestry-menus-notice__title{display:block;margin-bottom:.15rem;font-weight:600}
.tapestry-menus-notice a{color:inherit;font-weight:600;text-decoration:underline}
`;

/** A compass: navigation (decorative). */
const ICON =
	'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>';

const escapeAttr = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function noticeHtml(menusUrl: string): string {
	return (
		`<div class="tapestry-menus-notice" role="note" data-tapestry-menus-notice>${ICON}<p>` +
		'<span class="tapestry-menus-notice__title">Site navigation is managed by Tapestry Menus</span>' +
		`Add pages to menus in <a href="${escapeAttr(menusUrl)}">Dashboard → Menus</a>. Tapestry pages also have ` +
		'<strong>Navigation settings</strong> beside the editor, on the Page Content tab. ' +
		'StudioCMS’s “Show in navigation” setting isn’t used, so it’s hidden.</p></div>'
	);
}

/**
 * The form page's HTML with the field hidden and the notice at the end of the Basic Information tab;
 * unchanged when the markup isn't recognized (e.g. a StudioCMS update).
 */
export function injectNavNotice(html: string, menusUrl: string): string {
	const tab = html.indexOf('<sui-tab-item id="tab-label-basic-info"');
	if (tab < 0) return html;
	const end = html.indexOf('</sui-tab-item>', tab);
	const head = html.indexOf('</head>');
	if (end < 0 || head < 0 || head > tab) return html;
	const style = `<style data-tapestry-menus-nav>${HIDE_CSS}${NOTICE_CSS}</style>`;
	return html.slice(0, head) + style + html.slice(head, end) + noticeHtml(menusUrl) + html.slice(end);
}
