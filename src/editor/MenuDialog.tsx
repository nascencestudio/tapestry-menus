/**
 * The page editor's Menu dialog (ADR 0001), opened from Tapestry's editor bar (Tapestry ADR 0042):
 * where this page is linked in each menu. Admins add it to a menu (label, parent), rename or move its
 * entries and remove them; each menu is saved on its own and is live at once (not part of the page's
 * draft). Editors see where it's linked. No `name` attributes and `type="button"` everywhere: the
 * dashboard's page form saves named fields and submits on Enter.
 */
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { MenuConflict, randomItemId, type StoredMenu, saveMenu } from '../client/api.js';
import { CloseIcon } from '../client/icons.js';
import {
	addItem,
	LIMITS,
	locate,
	type Menu,
	moveItem,
	oneLine,
	parentChoices,
	placementsOf,
	removeItem,
	updateItem,
} from '../menus.js';

interface DialogData {
	page: { id: string; title: string; path: string };
	menus: StoredMenu[];
	canEdit: boolean;
}

interface Props {
	pageId: string;
	endpoint: string;
	onClose: () => void;
}

export function MenuDialog({ pageId, endpoint, onClose }: Props) {
	const dialog = useRef<HTMLDialogElement>(null);
	const [data, setData] = useState<DialogData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const uid = useId();

	useEffect(() => {
		const element = dialog.current;
		if (element && !element.open) element.showModal();
		return () => element?.close();
	}, []);

	useEffect(() => {
		let cancelled = false;
		fetch(`${endpoint}?id=${encodeURIComponent(pageId)}`, { headers: { Accept: 'application/json' } })
			.then(async (response) => {
				const body = await response.json().catch(() => null);
				if (!response.ok) throw new Error(body?.error ?? response.statusText);
				return body as DialogData;
			})
			.then((loaded) => !cancelled && setData(loaded))
			.catch((e: Error) => !cancelled && setError(`Couldn’t load the menus: ${e.message}`));
		return () => {
			cancelled = true;
		};
	}, [pageId, endpoint]);

	return (
		<dialog
			ref={dialog}
			class="tm-dialog tm-scope"
			aria-labelledby={`${uid}-title`}
			data-tm-dialog
			onCancel={(e) => {
				e.preventDefault();
				onClose();
			}}
			onKeyDown={(e) => {
				// Enter would submit the dashboard's page form (and save the page).
				if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
			}}
		>
			<div class="tm-dialog__body">
				<div class="tm-dialog__header">
					<h2 class="tm-dialog__title" id={`${uid}-title`}>
						Menus{data ? ` for “${data.page.title}”` : ''}
					</h2>
					<button type="button" class="tm-button tm-button--icon" aria-label="Close" onClick={onClose} data-tm-close>
						<CloseIcon />
					</button>
				</div>
				{error && (
					<p class="tm-notice tm-notice--error" role="alert">
						{error}
					</p>
				)}
				{!data && !error && <p class="tm-status">Loading…</p>}
				{data && (
					<>
						<p class="tm-help">
							{data.canEdit
								? 'Changes to a menu are live as soon as you save it (they aren’t part of this page’s draft). The page’s link is hidden from visitors while the page isn’t published.'
								: 'Only admins can change menus.'}
						</p>
						{data.menus.length === 0 && (
							<p class="tm-notice">There are no menus yet. Admins add them in Dashboard → Menus.</p>
						)}
						{data.menus.map((stored) => (
							<MenuPlacements key={stored.menu.id} initial={stored} page={data.page} canEdit={data.canEdit} />
						))}
					</>
				)}
				<div class="tm-dialog__footer">
					<button type="button" class="tm-button" onClick={onClose}>
						Close
					</button>
				</div>
			</div>
		</dialog>
	);
}

function MenuPlacements({
	initial,
	page,
	canEdit,
}: {
	initial: StoredMenu;
	page: DialogData['page'];
	canEdit: boolean;
}) {
	const [saved, setSaved] = useState(initial);
	const [menu, setMenu] = useState<Menu>(initial.menu);
	const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const uid = useId();
	const placements = placementsOf(menu, page.id);
	const dirty = JSON.stringify(menu) !== JSON.stringify(saved.menu);
	const emptyLabel = placements.some(({ item }) => !oneLine(item.label, LIMITS.label));

	const change = (next: Menu | null) => {
		if (!next) return;
		setMenu(next);
		setStatus(null);
	};

	function add() {
		const item = {
			id: randomItemId(),
			label: page.title.slice(0, LIMITS.label) || 'Page',
			link: { type: 'page' as const, page: page.id },
		};
		change(addItem(menu, null, item));
		requestAnimationFrame(() =>
			document.querySelector<HTMLInputElement>(`[data-tm-placement="${item.id}"] input`)?.select(),
		);
	}

	async function save() {
		if (busy) return;
		setBusy(true);
		setStatus({ kind: 'info', text: 'Saving…' });
		try {
			const next = await saveMenu(menu, saved.rev);
			setSaved(next);
			setMenu(next.menu);
			setStatus({ kind: 'info', text: 'Saved. The menu is live.' });
		} catch (error) {
			if (error instanceof MenuConflict && error.current) {
				setSaved(error.current);
				setMenu(error.current.menu);
				setStatus({
					kind: 'error',
					text: 'Someone else changed this menu meanwhile. It’s reloaded: make your change again.',
				});
			} else {
				setStatus({ kind: 'error', text: `Not saved: ${(error as Error).message}` });
			}
		} finally {
			setBusy(false);
		}
	}

	const parentLabel = (parent: string | null) => (parent ? (locate(menu.items, parent)?.item.label ?? '') : null);

	return (
		<section class="tm-menu" aria-labelledby={`${uid}-name`} data-tm-dialog-menu={menu.id}>
			<div class="tm-menu__head">
				<h3 class="tm-menu__name" id={`${uid}-name`}>
					{menu.name}
				</h3>
				{canEdit && (
					<button type="button" class="tm-button tm-button--small" onClick={add} data-tm-add-page>
						{placements.length ? 'Add again' : 'Add this page'}
					</button>
				)}
			</div>
			{placements.length === 0 && <p class="tm-help">This page isn’t in this menu.</p>}
			{placements.map(({ item, parent }) =>
				canEdit ? (
					<div class="tm-placement" key={item.id} data-tm-placement={item.id}>
						<div class="tm-field">
							<label class="tm-field__label" for={`${uid}-${item.id}-label`}>
								Label
							</label>
							<input
								id={`${uid}-${item.id}-label`}
								class="tm-input"
								value={item.label}
								maxLength={LIMITS.label}
								form="tapestry-detached"
								onInput={(e) => change(updateItem(menu, item.id, { label: e.currentTarget.value }))}
							/>
						</div>
						<div class="tm-field">
							<label class="tm-field__label" for={`${uid}-${item.id}-parent`}>
								Under
							</label>
							<select
								id={`${uid}-${item.id}-parent`}
								class="tm-select"
								value={parent ?? ''}
								data-tm-parent
								onChange={(e) => {
									const to = e.currentTarget.value || null;
									if (to !== parent) change(moveItem(menu, item.id, to, Number.MAX_SAFE_INTEGER));
								}}
							>
								<option value="">(top level)</option>
								{parentChoices(menu, item.id).map((choice) => (
									<option key={choice.id} value={choice.id}>
										{' '.repeat(choice.level - 1)}
										{choice.label}
									</option>
								))}
							</select>
						</div>
						<button
							type="button"
							class="tm-button tm-button--small"
							onClick={() => change(removeItem(menu, item.id))}
							data-tm-remove-placement
						>
							Remove
						</button>
					</div>
				) : (
					<p class="tm-help" key={item.id}>
						Linked as “{item.label}”{parent ? ` under “${parentLabel(parent)}”` : ' at the top level'}.
					</p>
				),
			)}
			{canEdit && (dirty || status) && (
				<div class="tm-dialog__footer">
					<p class="tm-status" role="status" data-kind={status?.kind}>
						{status?.text ?? (emptyLabel ? 'Give the entry a label.' : 'Not saved yet.')}
					</p>
					{dirty && (
						<button
							type="button"
							class="tm-button tm-button--primary tm-button--small"
							disabled={busy || emptyLabel}
							onClick={save}
							data-tm-save-menu
						>
							Save {menu.name}
						</button>
					)}
				</div>
			)}
		</section>
	);
}
