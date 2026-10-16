/**
 * One menu item's settings (the Menus page's side panel): label, link (a page, a web address or none),
 * new tab, description, extra CSS classes, who sees it, shown or not, and labels per language. Changes
 * apply to the menu at once (saved with the menu). No `name` attributes; buttons are `type="button"`.
 */
import { isSafeUrl } from '@nascencestudio/tapestry/links';
import { useId } from 'preact/hooks';
import { classSlug, LIMITS, type MenuItem } from '../menus.js';
import type { LinkablePage } from './api.js';

export interface Language {
	code: string;
	label: string;
}

interface Props {
	item: MenuItem;
	pages: LinkablePage[] | null;
	pagesError: string | null;
	languages: Language[];
	readOnly: boolean;
	onChange: (changes: Partial<Omit<MenuItem, 'id' | 'children'>>) => void;
}

type LinkKind = 'page' | 'url' | 'none';

/** A typed web address that isn't valid yet stays in the field; only valid ones reach the menu. */
export function urlProblem(value: string): string | null {
	if (!value) return 'Enter an address, or choose “No link”.';
	return isSafeUrl(value) ? null : 'Use an address starting with /, https://, mailto: or tel:.';
}

export function ItemForm({ item, pages, pagesError, languages, readOnly, onChange }: Props) {
	const uid = useId();
	const kind: LinkKind = item.link ? item.link.type : 'none';
	const pageId = item.link?.type === 'page' ? item.link.page : null;
	const page = pageId ? pages?.find((p) => p.id === pageId) : undefined;
	const url = item.link?.type === 'url' ? item.link.url : '';
	const newTab = Boolean(item.link?.newTab);
	const others = languages.slice(1);

	function setKind(next: LinkKind) {
		if (next === kind) return;
		const tab = newTab ? ({ newTab: true } as const) : {};
		if (next === 'none') onChange({ link: null });
		// No page chosen yet (saving asks for one).
		else if (next === 'page') onChange({ link: { type: 'page', page: '', ...tab } });
		else onChange({ link: { type: 'url', url: 'https://', ...tab } });
	}

	const problem = kind === 'url' ? urlProblem(url) : null;

	return (
		<fieldset class="tm-form" disabled={readOnly} data-tm-item-form={item.id}>
			<legend class="tm-sr-only">Item settings</legend>
			<div class="tm-field">
				<label class="tm-field__label" for={`${uid}-label`}>
					Label
				</label>
				<input
					id={`${uid}-label`}
					class="tm-input"
					value={item.label}
					maxLength={LIMITS.label}
					form="tapestry-detached"
					data-tm-field="label"
					onInput={(e) => onChange({ label: e.currentTarget.value })}
				/>
				<p class="tm-help">
					Class: <span class="tm-code">menu__item--{classSlug(item.label)}</span>
				</p>
			</div>

			{/* biome-ignore lint/a11y/useSemanticElements: a labelled group inside the form's fieldset, styled as a field */}
			<div class="tm-field" role="group" aria-labelledby={`${uid}-link`}>
				<span class="tm-field__label" id={`${uid}-link`}>
					Link
				</span>
				<div class="tm-segmented">
					{(
						[
							['page', 'Page'],
							['url', 'Web address'],
							['none', 'No link'],
						] as const
					).map(([value, text]) => (
						<button
							key={value}
							type="button"
							class="tm-button tm-button--small"
							aria-pressed={kind === value}
							data-tm-link-kind={value}
							onClick={() => setKind(value)}
						>
							{text}
						</button>
					))}
				</div>
				{kind === 'page' && (
					<>
						<label class="tm-sr-only" for={`${uid}-page`}>
							Page
						</label>
						<select
							id={`${uid}-page`}
							class="tm-select"
							data-tm-field="page"
							value={item.link?.type === 'page' ? item.link.page : ''}
							onChange={(e) =>
								onChange({ link: { type: 'page', page: e.currentTarget.value, ...(newTab ? { newTab: true } : {}) } })
							}
						>
							{!page && item.link?.type === 'page' && (
								<option value={item.link.page}>
									{!item.link.page ? 'Choose a page…' : pages ? 'Missing page (deleted?)' : 'Loading pages…'}
								</option>
							)}
							{pages?.map((p) => (
								<option key={p.id} value={p.id}>
									{p.title} ({p.path}){p.draft ? ', draft' : ''}
								</option>
							))}
						</select>
						{pagesError && <p class="tm-help">Couldn’t load the pages: {pagesError}</p>}
						<p class="tm-help">Follows the page when its address changes; hidden while it isn’t published.</p>
					</>
				)}
				{kind === 'url' && (
					<>
						<label class="tm-sr-only" for={`${uid}-url`}>
							Web address
						</label>
						<input
							id={`${uid}-url`}
							class="tm-input"
							type="text"
							inputMode="url"
							value={url}
							form="tapestry-detached"
							aria-invalid={problem ? 'true' : undefined}
							aria-describedby={problem ? `${uid}-url-problem` : undefined}
							data-tm-field="url"
							onInput={(e) =>
								onChange({
									link: { type: 'url', url: e.currentTarget.value.trim(), ...(newTab ? { newTab: true } : {}) },
								})
							}
						/>
						{problem && (
							<p class="tm-help" id={`${uid}-url-problem`} data-tm-problem>
								{problem}
							</p>
						)}
					</>
				)}
				{kind !== 'none' && (
					<label class="tm-check">
						<input
							type="checkbox"
							checked={newTab}
							data-tm-field="newTab"
							onChange={(e) => {
								const link = item.link;
								if (!link) return;
								const { newTab: _, ...rest } = link;
								onChange({ link: e.currentTarget.checked ? { ...rest, newTab: true } : rest });
							}}
						/>
						<span>Open in a new tab</span>
					</label>
				)}
			</div>

			<div class="tm-field">
				<label class="tm-field__label" for={`${uid}-visibility`}>
					Who sees it
				</label>
				<select
					id={`${uid}-visibility`}
					class="tm-select"
					value={item.visibility ?? 'everyone'}
					data-tm-field="visibility"
					onChange={(e) => {
						const value = e.currentTarget.value;
						onChange({ visibility: value === 'logged-in' || value === 'logged-out' ? value : undefined });
					}}
				>
					<option value="everyone">Everyone</option>
					<option value="logged-in">Only logged-in people</option>
					<option value="logged-out">Only people who aren’t logged in</option>
				</select>
			</div>

			<label class="tm-check">
				<input
					type="checkbox"
					checked={item.enabled !== false}
					data-tm-field="enabled"
					onChange={(e) => onChange({ enabled: e.currentTarget.checked ? undefined : false })}
				/>
				<span>Show this item (and the items under it)</span>
			</label>

			<div class="tm-field">
				<label class="tm-field__label" for={`${uid}-description`}>
					Description
				</label>
				<input
					id={`${uid}-description`}
					class="tm-input"
					value={item.description ?? ''}
					maxLength={LIMITS.description}
					form="tapestry-detached"
					data-tm-field="description"
					onInput={(e) => onChange({ description: e.currentTarget.value || undefined })}
				/>
				<p class="tm-help">Shown when hovering the link.</p>
			</div>

			<div class="tm-field">
				<label class="tm-field__label" for={`${uid}-class`}>
					Extra CSS classes
				</label>
				<input
					id={`${uid}-class`}
					class="tm-input tm-code"
					value={item.className ?? ''}
					maxLength={LIMITS.className}
					form="tapestry-detached"
					data-tm-field="className"
					onInput={(e) => onChange({ className: e.currentTarget.value || undefined })}
				/>
				<p class="tm-help">Separated by spaces, e.g. “button highlight”. Other characters are dropped on save.</p>
			</div>

			{others.length > 0 && (
				// biome-ignore lint/a11y/useSemanticElements: a labelled group inside the form's fieldset, styled as a field
				<div class="tm-field" role="group" aria-labelledby={`${uid}-labels`}>
					<span class="tm-field__label" id={`${uid}-labels`}>
						Label in other languages
					</span>
					{others.map((language) => (
						<div class="tm-field" key={language.code}>
							<label for={`${uid}-label-${language.code}`}>{language.label}</label>
							<input
								id={`${uid}-label-${language.code}`}
								class="tm-input"
								lang={language.code}
								value={item.labels?.[language.code] ?? ''}
								placeholder={item.label}
								maxLength={LIMITS.label}
								form="tapestry-detached"
								data-tm-field={`label-${language.code}`}
								onInput={(e) => {
									const labels = { ...item.labels, [language.code]: e.currentTarget.value };
									if (!labels[language.code]) delete labels[language.code];
									onChange({ labels: Object.keys(labels).length ? labels : undefined });
								}}
							/>
						</div>
					))}
					<p class="tm-help">Empty: the label above. Page links go to the page in the visitor’s language.</p>
				</div>
			)}
		</fieldset>
	);
}
