/**
 * Styles of the Menus page and the page editor's Navigation settings, added once when either opens. A string,
 * not a CSS import: CSS imported from browser code in a plugin can end up on every public page
 * (Tapestry known issue #32). Themed with the StudioCMS dashboard's variables.
 */
export const CSS = `
.tm-scope {
	--tm-bg: var(--background-step-1, hsl(0 0% 94%));
	--tm-row: var(--background-step-2, hsl(0 0% 90%));
	--tm-field: var(--background-base, hsl(0 0% 97%));
	--tm-border: var(--border, hsl(263 5% 68%));
	--tm-text: var(--text-normal, hsl(0 0% 5%));
	--tm-muted: var(--text-muted, hsl(0 0% 35%));
	--tm-primary: var(--primary-base, hsl(259 74% 45%));
	--tm-on-primary: var(--text-inverted, #fff);
	--tm-danger: hsl(339 80% 36%);
	--tm-radius: var(--radius-md, 0.5rem);
	color: var(--tm-text);
	font-size: 0.875rem;
}
[data-theme="dark"] .tm-scope { --tm-danger: hsl(339 90% 74%); }
.tm-scope *, .tm-scope *::before, .tm-scope *::after { box-sizing: border-box; }
.tm-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

.tm-button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.375rem;
	padding: 0.4rem 0.8rem;
	font: inherit;
	color: var(--tm-text);
	background: var(--tm-field);
	border: 1px solid var(--tm-border);
	border-radius: calc(var(--tm-radius) - 0.125rem);
	cursor: pointer;
	white-space: nowrap;
}
.tm-button:hover:not(:disabled) { border-color: var(--tm-primary); }
.tm-button:disabled { opacity: 0.6; cursor: default; }
.tm-button--primary { color: var(--tm-on-primary); background: var(--tm-primary); border-color: var(--tm-primary); }
.tm-button--danger { color: #fff; background: hsl(339 80% 36%); border-color: hsl(339 80% 36%); }
.tm-button--small { padding: 0.2rem 0.5rem; font-size: 0.8125rem; }
.tm-button--icon { padding: 0.25rem; width: 1.9rem; height: 1.9rem; }
.tm-button--icon svg { width: 1rem; height: 1rem; }
.tm-input, .tm-select {
	width: 100%;
	padding: 0.45rem 0.6rem;
	font: inherit;
	color: var(--tm-text);
	background: var(--tm-field);
	border: 1px solid var(--tm-border);
	border-radius: calc(var(--tm-radius) - 0.125rem);
}
.tm-input:focus-visible, .tm-select:focus-visible, .tm-button:focus-visible, .tm-check input:focus-visible,
.tm-row__select:focus-visible {
	outline: 2px solid var(--tm-primary);
	outline-offset: 2px;
}
.tm-field { display: flex; flex-direction: column; gap: 0.25rem; }
.tm-field__label { font-weight: 600; }
.tm-help { margin: 0; color: var(--tm-muted); font-size: 0.8125rem; }
.tm-check { display: flex; gap: 0.5rem; align-items: flex-start; }
.tm-check input { margin: 0.15rem 0 0; width: 1rem; height: 1rem; accent-color: var(--tm-primary); }
.tm-status { color: var(--tm-muted); }
.tm-status[data-kind="error"] { color: var(--tm-danger); }
.tm-notice { margin: 0; padding: 0.6rem 0.8rem; background: var(--tm-bg); border: 1px solid var(--tm-border); border-radius: var(--tm-radius); }
.tm-notice--error { border-color: var(--tm-danger); color: var(--tm-danger); }
.tm-badge {
	display: inline-flex;
	align-items: center;
	padding: 0 0.4rem;
	font-size: 0.75rem;
	line-height: 1.4rem;
	color: var(--tm-text);
	border: 1px solid var(--tm-border);
	border-radius: 999px;
	white-space: nowrap;
}
.tm-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8125rem; overflow-wrap: anywhere; }

/* The Menus page */
.tm-page { display: flex; flex-direction: column; gap: 1rem; padding-bottom: 2rem; }
.tm-page__header { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end; }
.tm-page__name { flex: 1 1 16rem; }
.tm-page__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.tm-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem); gap: 1rem; align-items: start; }
@container (max-width: 52rem) { .tm-layout { grid-template-columns: minmax(0, 1fr); } }
.tm-page { container-type: inline-size; }
.tm-panel { padding: 1rem; background: var(--tm-bg); border: 1px solid var(--tm-border); border-radius: var(--tm-radius); }
.tm-panel__title { margin: 0 0 0.75rem; font-size: 1rem; font-weight: 600; }
.tm-tree { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.tm-tree__empty { margin: 0; color: var(--tm-muted); }
.tm-row {
	position: relative;
	display: flex;
	align-items: center;
	gap: 0.5rem;
	min-height: 2.6rem;
	padding: 0.25rem 0.5rem;
	margin-left: calc(var(--tm-level, 0) * 1.5rem);
	background: var(--tm-field);
	border: 1px solid var(--tm-border);
	border-radius: calc(var(--tm-radius) - 0.125rem);
	cursor: pointer;
}
.tm-row:has([aria-current="true"]) { border-color: var(--tm-primary); box-shadow: inset 3px 0 0 var(--tm-primary); }
.tm-row[data-dragging] { opacity: 0.45; }
.tm-row__select {
	display: flex;
	flex: 1;
	gap: 0.5rem;
	align-items: center;
	min-width: 0;
	padding: 0.25rem 0;
	font: inherit;
	color: inherit;
	text-align: left;
	background: none;
	border: 0;
	border-radius: 0.25rem;
	cursor: pointer;
}
.tm-row[data-off] .tm-row__label { text-decoration: line-through; }
.tm-row__label { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tm-row__link { flex: 1; min-width: 0; color: var(--tm-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tm-row__link[data-missing] { color: var(--tm-danger); }
.tm-row__badges { display: flex; gap: 0.25rem; }
.tm-row__tools { display: flex; gap: 0.25rem; }
.tm-handle {
	display: inline-flex;
	padding: 0.15rem;
	color: var(--tm-muted);
	cursor: grab;
}
.tm-row[draggable="true"] { -webkit-user-drag: element; }
.tm-handle svg { width: 1rem; height: 1rem; }
.tm-drop-line {
	position: absolute;
	right: 0;
	height: 2px;
	background: var(--tm-primary);
	pointer-events: none;
}
.tm-drop-line::before {
	content: '';
	position: absolute;
	left: -4px;
	top: -3px;
	width: 8px;
	height: 8px;
	border: 2px solid var(--tm-primary);
	border-radius: 50%;
	background: var(--tm-field);
}
.tm-row[data-drop="make-child"] { outline: 2px solid var(--tm-primary); }
.tm-form { display: flex; flex-direction: column; gap: 0.875rem; margin: 0; padding: 0; border: 0; min-width: 0; }
.tm-form__row { display: flex; gap: 0.5rem; }
.tm-form__row > * { flex: 1; }
.tm-segmented { display: flex; gap: 0; }
.tm-segmented .tm-button { border-radius: 0; flex: 1; }
.tm-segmented .tm-button:first-child { border-radius: calc(var(--tm-radius) - 0.125rem) 0 0 calc(var(--tm-radius) - 0.125rem); }
.tm-segmented .tm-button:last-child { border-radius: 0 calc(var(--tm-radius) - 0.125rem) calc(var(--tm-radius) - 0.125rem) 0; }
.tm-segmented .tm-button[aria-pressed="true"] { color: var(--tm-on-primary); background: var(--tm-primary); border-color: var(--tm-primary); }
.tm-list { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); }
.tm-card { display: flex; flex-direction: column; gap: 0.25rem; padding: 1rem; color: inherit; text-decoration: none; background: var(--tm-bg); border: 1px solid var(--tm-border); border-radius: var(--tm-radius); }
.tm-card:hover { border-color: var(--tm-primary); }
.tm-card__name { font-weight: 600; font-size: 1rem; }
.tm-create { display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap; }
.tm-create .tm-field { flex: 1 1 14rem; }

/* The page editor's Navigation settings (a section under Tapestry's settings panel) */
.tm-settings { display: flex; flex-direction: column; gap: 0.75rem; }
.tm-settings__list { margin: 0; padding-left: 1.1rem; }
.tm-settings__actions { display: flex; flex-direction: column; align-items: flex-start; gap: 0.4rem; }
.tm-settings__actions .tm-status { margin: 0; }
`;

let added = false;

export function ensureStyles(): void {
	if (added || document.querySelector('style[data-tapestry-menus-styles]')) return;
	const style = document.createElement('style');
	style.dataset.tapestryMenusStyles = '';
	style.textContent = CSS;
	document.head.append(style);
	added = true;
}
