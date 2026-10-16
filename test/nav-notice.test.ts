import { describe, expect, it } from 'vitest';
import { CONTENT_FORM, injectNavNotice, noticeHtml } from '../src/nav-notice.js';

const MENUS = '/dashboard/nascencestudio_tapestry_menus/menus';
// The shape StudioCMS 0.6.1 renders (trimmed): the field's row, the Basic Information tab, the next tab.
const page = `<html><head><title>Edit</title></head><body><form id="edit-page-form">
<sui-tab-item id="tab-label-basic-info" data-label="Basic Information"><div class="tab-section">
<div class="form-row-item"><sui-select id="show-in-nav-container"><select class="sui-hidden-select" id="show-in-nav" name="show-in-nav" hidden><option value="true">True</option></select></sui-select></div>
</div></sui-tab-item><sui-tab-item id="tab-label-content" data-label="Page Content"></sui-tab-item></form></body></html>`;

describe('the "Show in navigation" notice', () => {
	it('matches only the page create and edit forms', () => {
		for (const path of [
			'/dashboard/content-management/edit',
			'/dashboard/content-management/create/',
			'/admin/content-management/edit',
		]) {
			expect(CONTENT_FORM.test(path)).toBe(true);
		}
		for (const path of [
			'/dashboard/content-management',
			'/dashboard/content-management/edit-folder',
			'/content-management/edit',
			'/dashboard/x/content-management/edit',
		]) {
			expect(CONTENT_FORM.test(path)).toBe(false);
		}
	});

	it('hides the field and ends the Basic Information tab with the notice', () => {
		const html = injectNavNotice(page, MENUS);
		expect(html).toContain(
			'<style data-tapestry-menus-nav>.form-row-item:has(> sui-select > select#show-in-nav){display:none}',
		);
		expect(html.indexOf('<style data-tapestry-menus-nav>')).toBeLessThan(html.indexOf('</head>'));
		const notice = html.indexOf('data-tapestry-menus-notice');
		expect(notice).toBeGreaterThan(html.indexOf('tab-label-basic-info'));
		expect(notice).toBeLessThan(html.indexOf('</sui-tab-item>'));
		expect(html.indexOf('</sui-tab-item>')).toBeLessThan(html.indexOf('tab-label-content'));
		// The field itself stays in the form (its stored value is sent unchanged).
		expect(html).toContain('name="show-in-nav"');
	});

	it('leaves pages it doesn’t recognize unchanged', () => {
		expect(injectNavNotice('<html><head></head><body>other</body></html>', MENUS)).toBe(
			'<html><head></head><body>other</body></html>',
		);
		const noHead = page.replace('</head>', '');
		expect(injectNavNotice(noHead, MENUS)).toBe(noHead);
		const unclosed = page.replace(/<\/sui-tab-item>/g, '');
		expect(injectNavNotice(unclosed, MENUS)).toBe(unclosed);
	});

	it('links Dashboard → Menus, escaped', () => {
		expect(noticeHtml(MENUS)).toContain(`<a href="${MENUS}">Dashboard → Menus</a>`);
		expect(noticeHtml('/a"><b>')).toContain('href="/a&quot;&gt;&lt;b&gt;"');
		expect(noticeHtml(MENUS)).toContain('role="note"');
	});
});
