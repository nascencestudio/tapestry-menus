/**
 * The page editor's **Navigation settings** (ADR 0001), a section under Tapestry's settings panel like
 * Drupal's node sidebar: "Provide a menu link", its title, its parent (a menu's top level or an item in
 * any menu) and a description. Saving updates the menu at once (live; not part of the page's draft).
 * When the page is linked more than once, the first link is edited here and the others are listed.
 * Editors see where the page is linked. It sits inside StudioCMS's page form: no `name` attributes,
 * detached inputs, `type="button"`, and Enter never submits.
 */
import { useEffect, useId, useState } from 'preact/hooks';
import { MenuConflict, randomItemId, saveMenu } from '../client/api.js';
import { LIMITS, locate, parentChoices } from '../menus.js';
import { allPlacements, type FormState, initialForm, keyOf, type PageData, type Placement, planSave } from './plan.js';

interface Props {
	pageId: string;
	endpoint: string;
}

export function MenuSettings({ pageId, endpoint }: Props) {
	const [data, setData] = useState<PageData | null>(null);
	const [form, setForm] = useState<FormState | null>(null);
	const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const uid = useId();

	async function load(): Promise<PageData | null> {
		const response = await fetch(`${endpoint}?id=${encodeURIComponent(pageId)}`, {
			headers: { Accept: 'application/json' },
		});
		const body = await response.json().catch(() => null);
		if (!response.ok) throw new Error(body?.error ?? response.statusText);
		const loaded = body as PageData;
		setData(loaded);
		setForm(initialForm(loaded));
		return loaded;
	}

	useEffect(() => {
		load().catch((e: Error) => setStatus({ kind: 'error', text: `Couldn’t load the menus: ${e.message}` }));
	}, [pageId, endpoint]);

	if (!data || !form) {
		return (
			<div class="tm-scope tm-settings">
				<p class="tm-status" role="status" data-kind={status?.kind}>
					{status?.text ?? 'Loading…'}
				</p>
			</div>
		);
	}

	const placements = allPlacements(data.menus, pageId);
	const first = placements[0];
	const others = placements.slice(1);
	const dirty = JSON.stringify(form) !== JSON.stringify(initialForm(data));
	const set = (changes: Partial<FormState>) => {
		setForm({ ...form, ...changes });
		setStatus(null);
	};
	const where = (p: Placement) =>
		`“${p.item.label}” in ${p.menu.name}${p.parent ? `, under “${locate(p.menu.items, p.parent)?.item.label ?? ''}”` : ''}`;

	async function save() {
		if (!data || !form || busy) return;
		const plan = planSave(data.menus, pageId, form, randomItemId);
		if ('error' in plan) {
			setStatus({ kind: 'error', text: plan.error });
			return;
		}
		setBusy(true);
		setStatus({ kind: 'info', text: 'Saving…' });
		try {
			for (const stored of plan.saves) await saveMenu(stored.menu, stored.rev);
			await load();
			setStatus({ kind: 'info', text: form.provide ? 'Saved. The menu link is live.' : 'Removed from the menu.' });
		} catch (error) {
			if (error instanceof MenuConflict) {
				await load().catch(() => {});
				setStatus({ kind: 'error', text: 'The menu was changed elsewhere meanwhile. It’s reloaded: try again.' });
			} else {
				setStatus({ kind: 'error', text: `Not saved: ${(error as Error).message}` });
			}
		} finally {
			setBusy(false);
		}
	}

	if (!data.canEdit) {
		return (
			<div class="tm-scope tm-settings" data-tm-settings>
				{placements.length ? (
					<ul class="tm-settings__list">
						{placements.map((p) => (
							<li key={p.item.id}>Linked as {where(p)}.</li>
						))}
					</ul>
				) : (
					<p class="tm-help">This page isn’t in a menu.</p>
				)}
				<p class="tm-help">Only admins can change menus.</p>
			</div>
		);
	}

	if (data.menus.length === 0) {
		return (
			<div class="tm-scope tm-settings" data-tm-settings>
				<p class="tm-help">There are no menus yet. Add one in Dashboard → Menus.</p>
			</div>
		);
	}

	// Parent choices: each menu's top level, then its items (not this link or anything under it).
	const firstMenuId = first?.menu.id;
	const choices = data.menus.flatMap(({ menu }) => [
		{ key: keyOf(menu.id, null), text: `<${menu.name}>` },
		...parentChoices(menu, menu.id === firstMenuId ? first?.item.id : undefined).map((c) => ({
			key: keyOf(menu.id, c.id),
			text: `${'—'.repeat(c.level)} ${c.label}`,
		})),
	]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: only stops Enter from submitting the page form
		<div
			class="tm-scope tm-settings"
			data-tm-settings
			onKeyDown={(e) => {
				if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
			}}
		>
			<label class="tm-check">
				<input
					type="checkbox"
					checked={form.provide}
					form="tapestry-detached"
					data-tm-provide
					onChange={(e) => set({ provide: e.currentTarget.checked })}
				/>
				<span>Provide a menu link</span>
			</label>
			{form.provide && (
				<>
					<div class="tm-field">
						<label class="tm-field__label" for={`${uid}-label`}>
							Menu link title
						</label>
						<input
							id={`${uid}-label`}
							class="tm-input"
							value={form.label}
							maxLength={LIMITS.label}
							form="tapestry-detached"
							data-tm-link-title
							onInput={(e) => set({ label: e.currentTarget.value })}
						/>
					</div>
					<div class="tm-field">
						<label class="tm-field__label" for={`${uid}-parent`}>
							Parent item
						</label>
						<select
							id={`${uid}-parent`}
							class="tm-select"
							value={form.parent}
							form="tapestry-detached"
							data-tm-link-parent
							onChange={(e) => set({ parent: e.currentTarget.value })}
						>
							{choices.map((choice) => (
								<option key={choice.key} value={choice.key}>
									{choice.text}
								</option>
							))}
						</select>
						<p class="tm-help">New links go at the end. Reorder them in Dashboard → Menus.</p>
					</div>
					<div class="tm-field">
						<label class="tm-field__label" for={`${uid}-description`}>
							Description
						</label>
						<input
							id={`${uid}-description`}
							class="tm-input"
							value={form.description}
							maxLength={LIMITS.description}
							form="tapestry-detached"
							data-tm-link-description
							onInput={(e) => set({ description: e.currentTarget.value })}
						/>
						<p class="tm-help">Shown when hovering the link.</p>
					</div>
				</>
			)}
			{others.length > 0 && (
				<div class="tm-field">
					<span class="tm-field__label">Also linked</span>
					<ul class="tm-settings__list">
						{others.map((p) => (
							<li key={p.item.id}>{where(p)}</li>
						))}
					</ul>
					<p class="tm-help">Change these in Dashboard → Menus.</p>
				</div>
			)}
			<div class="tm-settings__actions">
				<button
					type="button"
					class="tm-button tm-button--primary tm-button--small"
					disabled={!dirty || busy}
					onClick={save}
					data-tm-save-link
				>
					Save menu link
				</button>
				<p class="tm-status" role="status" data-kind={status?.kind} data-tm-settings-status>
					{status?.text ?? (dirty ? 'Not saved yet. Menu links are live when saved.' : '')}
				</p>
			</div>
		</div>
	);
}
