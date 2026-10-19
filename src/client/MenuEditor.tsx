/**
 * The Menus page's editor for one menu (ADR 0001): the tree of items (drag and drop, or the buttons on
 * the selected item for keyboards), the selected item's settings beside it, the menu's name, Save
 * (makes it live) and Delete. Read-only for editors. A save from an outdated copy is refused by the
 * server; the editor then offers to load the current version.
 */
import {
	draggable,
	dropTargetForElements,
	monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/utils/combine';
import { attachInstruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item/attach-instruction';
import { extractInstruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item/extract-instruction';
import type { JSX } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import {
	addItem,
	applyDrop,
	classSlug,
	type DropInstruction,
	LIMITS,
	locate,
	type Menu,
	type MenuItem,
	moveItem,
	oneLine,
	removeItem,
	updateItem,
} from '../menus.js';
import {
	deleteMenu,
	type LinkablePage,
	loadPages,
	MenuConflict,
	randomItemId,
	type StoredMenu,
	saveMenu,
} from './api.js';
import { ItemForm, type Language, urlProblem } from './ItemForm.js';
import { DownIcon, GripIcon, IndentIcon, OutdentIcon, PlusIcon, TrashIcon, UpIcon } from './icons.js';

const INDENT = 24;

interface Props {
	initial: StoredMenu;
	canEdit: boolean;
	languages: Language[];
	/** The Menus page (after deleting). */
	listUrl: string;
}

interface Row {
	item: MenuItem;
	level: number;
	parent: string | null;
	index: number;
	siblings: number;
}

function rowsOf(items: readonly MenuItem[], level = 1, parent: string | null = null): Row[] {
	return items.flatMap((item, index) => [
		{ item, level, parent, index, siblings: items.length },
		...rowsOf(item.children ?? [], level + 1, item.id),
	]);
}

/** What stops a save: an empty label or an invalid address (the server would drop the link). */
export function menuProblems(menu: Menu): Array<{ id: string; text: string }> {
	return rowsOf(menu.items).flatMap(({ item }) => {
		const problems: Array<{ id: string; text: string }> = [];
		if (!oneLine(item.label, LIMITS.label)) problems.push({ id: item.id, text: 'An item has no label.' });
		const url = item.link?.type === 'url' ? urlProblem(item.link.url) : null;
		if (url) problems.push({ id: item.id, text: `“${item.label}”: ${url}` });
		if (item.link?.type === 'page' && !item.link.page)
			problems.push({ id: item.id, text: `“${item.label}”: choose a page.` });
		return problems;
	});
}

function linkSummary(item: MenuItem, pages: LinkablePage[] | null): { text: string; missing?: boolean } {
	if (!item.link) return { text: 'No link' };
	if (item.link.type === 'url') return { text: item.link.url };
	const pageId = item.link.page;
	if (!pageId) return { text: 'No page chosen', missing: true };
	const page = pages?.find((p) => p.id === pageId);
	if (!pages) return { text: 'Page' };
	return page ? { text: `${page.title} (${page.path})` } : { text: 'Missing page', missing: true };
}

export function MenuEditor({ initial, canEdit, languages, listUrl }: Props) {
	const [menu, setMenu] = useState(initial.menu);
	const [saved, setSaved] = useState(initial);
	const [selected, setSelected] = useState<string | null>(initial.menu.items[0]?.id ?? null);
	const [pages, setPages] = useState<LinkablePage[] | null>(null);
	const [pagesError, setPagesError] = useState<string | null>(null);
	const [status, setStatus] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
	const [conflict, setConflict] = useState<StoredMenu | null>(null);
	const [busy, setBusy] = useState(false);
	const uid = useId();
	const menuRef = useRef(menu);
	menuRef.current = menu;
	/** Set when leaving on purpose (after deleting the menu): no unsaved-changes prompt. */
	const leaving = useRef(false);

	const dirty = JSON.stringify(menu) !== JSON.stringify(saved.menu);
	const rows = useMemo(() => rowsOf(menu.items), [menu]);
	const problems = useMemo(() => menuProblems(menu), [menu]);
	const current = selected ? locate(menu.items, selected) : null;

	useEffect(() => {
		loadPages()
			.then(setPages)
			.catch((error: Error) => setPagesError(error.message));
	}, []);

	// Leaving with unsaved changes asks first.
	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => {
			if (!leaving.current) event.preventDefault();
		};
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	}, [dirty]);

	// Drops anywhere in the tree.
	useEffect(() => {
		if (!canEdit) return;
		return monitorForElements({
			canMonitor: ({ source }) => typeof source.data.menuItem === 'string',
			onDrop: ({ source, location }) => {
				const target = location.current.dropTargets[0];
				if (!target) return;
				const instruction = extractInstruction(target.data);
				if (!instruction) return;
				const next = applyDrop(
					menuRef.current,
					String(source.data.menuItem),
					String(target.data.menuItem),
					instruction as DropInstruction,
				);
				if (next) change(next, `Moved “${locate(next.items, String(source.data.menuItem))?.item.label}”.`);
			},
		});
	}, [canEdit]);

	function change(next: Menu, announce?: string) {
		setMenu(next);
		setStatus(announce ? { kind: 'info', text: announce } : null);
	}

	function addNew(parent: string | null) {
		const item: MenuItem = { id: randomItemId(), label: 'New item', link: null };
		change(addItem(menu, parent, item), 'Item added. Give it a label and a link.');
		setSelected(item.id);
		requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-tm-field="label"]')?.select());
	}

	function move(id: string, how: 'up' | 'down' | 'in' | 'out') {
		const at = locate(menu.items, id);
		if (!at) return;
		let next: Menu | null = null;
		if (how === 'up' && at.index > 0) next = moveItem(menu, id, at.parent, at.index - 1);
		if (how === 'down') next = moveItem(menu, id, at.parent, at.index + 1);
		if (how === 'in' && at.index > 0) {
			const siblings = at.parent ? (locate(menu.items, at.parent)?.item.children ?? []) : menu.items;
			const previous = siblings[at.index - 1];
			if (previous) next = moveItem(menu, id, previous.id, previous.children?.length ?? 0);
		}
		if (how === 'out' && at.parent) {
			const parent = locate(menu.items, at.parent);
			if (parent) next = moveItem(menu, id, parent.parent, parent.index + 1);
		}
		if (!next || JSON.stringify(next) === JSON.stringify(menu)) {
			setStatus({ kind: 'info', text: 'It can’t move that way.' });
			return;
		}
		const moved = locate(next.items, id);
		change(next, `Moved to level ${moved?.level}, position ${(moved?.index ?? 0) + 1}.`);
		// Keep the focus on the button that was used (the row re-renders in its new place).
		requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-tm-move="${how}"]`)?.focus());
	}

	function remove(id: string) {
		const at = locate(menu.items, id);
		if (!at) return;
		const count = rowsOf([at.item]).length;
		if (count > 1 && !window.confirm(`Remove “${at.item.label}” and the ${count - 1} item(s) under it?`)) return;
		change(removeItem(menu, id), `Removed “${at.item.label}”.`);
		setSelected(null);
	}

	async function save() {
		if (busy || !dirty) return;
		if (problems.length) {
			setSelected(problems[0]?.id ?? selected);
			setStatus({ kind: 'error', text: `Not saved: ${problems[0]?.text}` });
			return;
		}
		setBusy(true);
		setStatus({ kind: 'info', text: 'Saving…' });
		try {
			const next = await saveMenu(menu, saved.rev);
			setSaved(next);
			setMenu(next.menu);
			setConflict(null);
			setStatus({ kind: 'info', text: 'Saved. The menu is live.' });
		} catch (error) {
			if (error instanceof MenuConflict) setConflict(error.current);
			setStatus({ kind: 'error', text: `Not saved: ${(error as Error).message}` });
		} finally {
			setBusy(false);
		}
	}

	async function removeMenu() {
		if (!window.confirm(`Delete the menu “${saved.menu.name}”? Pages and templates showing it will show nothing.`))
			return;
		setBusy(true);
		try {
			await deleteMenu(menu.id);
			leaving.current = true;
			window.location.assign(listUrl);
		} catch (error) {
			setStatus({ kind: 'error', text: `Not deleted: ${(error as Error).message}` });
			setBusy(false);
		}
	}

	function loadCurrent() {
		if (!conflict) return;
		setSaved(conflict);
		setMenu(conflict.menu);
		setConflict(null);
		setStatus({ kind: 'info', text: 'Loaded the current version. Make your changes again.' });
	}

	return (
		<div class="tm-page" data-tm-menu-editor={menu.id} data-dirty={dirty ? '' : undefined}>
			{!canEdit && (
				<p class="tm-notice" role="note" data-tm-readonly>
					Only admins can change menus. You can place menus on pages with the Menu component.
				</p>
			)}
			{/* The menu itself: its name, then a bar with the status and the menu's actions (like a template's card). */}
			<section class="tm-group" aria-label="Menu">
				<div class="tm-group__body">
					<div class="tm-field tm-name-field">
						<label class="tm-field__label" for={`${uid}-name`}>
							Menu name
						</label>
						<input
							id={`${uid}-name`}
							class="tm-input"
							value={menu.name}
							maxLength={LIMITS.name}
							disabled={!canEdit}
							data-tm-field="menu-name"
							onInput={(e) => change({ ...menu, name: e.currentTarget.value })}
						/>
						<p class="tm-help">
							Class: <span class="tm-code">menu--{classSlug(menu.name, 'menu')}</span> · id:{' '}
							<span class="tm-code">{menu.id}</span>
						</p>
					</div>
				</div>
				{canEdit && (
					<div class="tm-group__bar">
						<p class="tm-status tm-group__status" role="status" data-kind={status?.kind} data-tm-status>
							{status?.text ?? (dirty ? 'Unsaved changes.' : 'All changes saved.')}
						</p>
						<button type="button" class="tm-button" onClick={() => addNew(null)} data-tm-add-top>
							<PlusIcon /> Add item
						</button>
						<button
							type="button"
							class="tm-button tm-button--primary"
							disabled={!dirty || busy || !oneLine(menu.name, LIMITS.name)}
							onClick={save}
							data-tm-save
						>
							Save
						</button>
						<button
							type="button"
							class="tm-button tm-button--danger"
							disabled={busy}
							onClick={removeMenu}
							data-tm-delete-menu
						>
							Delete menu
						</button>
					</div>
				)}
			</section>
			{conflict && (
				<p class="tm-notice tm-notice--error" role="alert">
					Someone else saved this menu meanwhile.{' '}
					<button type="button" class="tm-button tm-button--small" onClick={loadCurrent} data-tm-load-current>
						Load their version
					</button>
				</p>
			)}

			<div class="tm-layout">
				<section class="tm-panel" aria-labelledby={`${uid}-items`}>
					<h2 class="tm-panel__title" id={`${uid}-items`}>
						Items
					</h2>
					{rows.length === 0 ? (
						<p class="tm-tree__empty">No items yet.{canEdit ? ' Add the first one with “Add item”.' : ''}</p>
					) : (
						<ul class="tm-tree" aria-label={`Items of ${menu.name}`} data-tm-tree>
							{rows.map((row) => (
								<TreeRow
									key={row.item.id}
									row={row}
									pages={pages}
									selected={row.item.id === selected}
									canEdit={canEdit}
									onSelect={() => setSelected(row.item.id)}
									onMove={(how) => move(row.item.id, how)}
									onAddChild={() => addNew(row.item.id)}
									onRemove={() => remove(row.item.id)}
								/>
							))}
						</ul>
					)}
					{canEdit && rows.length > 0 && (
						<p class="tm-help" style="margin-top:0.75rem">
							Drag items to reorder or nest them (drop on an item to put it under it), or select one and use its
							buttons.
						</p>
					)}
				</section>
				<section class="tm-panel" aria-labelledby={`${uid}-settings`}>
					<h2 class="tm-panel__title" id={`${uid}-settings`}>
						{current ? `Item: ${current.item.label || '(no label)'}` : 'Item settings'}
					</h2>
					{current ? (
						<ItemForm
							key={current.item.id}
							item={current.item}
							pages={pages}
							pagesError={pagesError}
							languages={languages}
							readOnly={!canEdit}
							onChange={(changes) => change(updateItem(menu, current.item.id, changes))}
						/>
					) : (
						<p class="tm-help">Select an item to see its settings.</p>
					)}
				</section>
			</div>
		</div>
	);
}

interface RowProps {
	row: Row;
	pages: LinkablePage[] | null;
	selected: boolean;
	canEdit: boolean;
	onSelect: () => void;
	onMove: (how: 'up' | 'down' | 'in' | 'out') => void;
	onAddChild: () => void;
	onRemove: () => void;
}

function TreeRow({ row, pages, selected, canEdit, onSelect, onMove, onAddChild, onRemove }: RowProps) {
	const { item, level } = row;
	const outer = useRef<HTMLLIElement>(null);
	const rowRef = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState(false);
	const [instruction, setInstruction] = useState<ReturnType<typeof extractInstruction>>(null);
	const hasChildren = Boolean(item.children?.length);
	const mode = hasChildren ? 'expanded' : row.index === row.siblings - 1 ? 'last-in-group' : 'standard';

	useEffect(() => {
		const element = outer.current;
		const row = rowRef.current;
		if (!canEdit || !element || !row) return;
		return combine(
			// The row is dragged (like Tapestry's layer tree); the whole item, tools included, is the drop target.
			draggable({
				element: row,
				getInitialData: () => ({ menuItem: item.id }),
				// Never change the drag source during dragstart (Chrome aborts the drag).
				onDragStart: () => setTimeout(() => setDragging(true), 0),
				onDrop: () => setDragging(false),
			}),
			dropTargetForElements({
				element,
				canDrop: ({ source }) => typeof source.data.menuItem === 'string',
				getData: ({ input, element: target }) =>
					attachInstruction(
						{ menuItem: item.id },
						{
							input,
							element: target,
							currentLevel: level - 1,
							indentPerLevel: INDENT,
							mode,
							block: level >= LIMITS.depth ? ['make-child'] : [],
						},
					),
				onDrag: ({ self, source }) =>
					setInstruction(source.data.menuItem === item.id ? null : extractInstruction(self.data)),
				onDragLeave: () => setInstruction(null),
				onDrop: () => setInstruction(null),
			}),
		);
	}, [canEdit, item.id, level, mode]);

	const link = linkSummary(item, pages);
	const line =
		instruction?.type === 'reorder-above'
			? { top: '-3px', left: `${(level - 1) * INDENT}px` }
			: instruction?.type === 'reorder-below'
				? { bottom: '-3px', left: `${(level - 1) * INDENT}px` }
				: instruction?.type === 'reparent'
					? { bottom: '-3px', left: `${instruction.desiredLevel * INDENT}px` }
					: null;

	return (
		<li
			ref={outer}
			style={{ position: 'relative', paddingLeft: `${(level - 1) * INDENT}px` }}
			data-tm-item={item.id}
			data-tm-level={level}
		>
			{/* The row: a grip (a hint that it can be dragged) and a select button (no nested controls). A click
			    anywhere on the row selects too (a mouse convenience; the button is the accessible way). */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: the select button inside handles keyboards */}
			<div
				ref={rowRef}
				class="tm-row"
				data-dragging={dragging ? '' : undefined}
				data-off={item.enabled === false ? '' : undefined}
				data-drop={instruction?.type === 'make-child' ? 'make-child' : undefined}
				onClick={onSelect}
			>
				{canEdit && (
					<span class="tm-handle" aria-hidden="true">
						<GripIcon />
					</span>
				)}
				<button type="button" class="tm-row__select" aria-current={selected ? 'true' : undefined} data-tm-select>
					<span class="tm-row__label">{item.label || '(no label)'}</span>
					<span class="tm-sr-only">, level {level}:</span>
					<span class="tm-row__link" data-missing={link.missing ? '' : undefined}>
						{link.text}
					</span>
				</button>
				<span class="tm-row__badges">
					{item.link?.newTab && <span class="tm-badge">New tab</span>}
					{item.visibility === 'logged-in' && <span class="tm-badge">Logged in</span>}
					{item.visibility === 'logged-out' && <span class="tm-badge">Logged out</span>}
					{item.enabled === false && <span class="tm-badge">Hidden</span>}
				</span>
			</div>
			{canEdit && selected && (
				// biome-ignore lint/a11y/useSemanticElements: a toolbar-like group of buttons, not a form section
				<div
					class="tm-row__tools"
					role="group"
					aria-label={`Move or change ${item.label}`}
					style="margin:0.25rem 0 0.25rem"
				>
					<ToolButton
						label="Move up"
						icon={<UpIcon />}
						move="up"
						disabled={row.index === 0}
						onClick={() => onMove('up')}
					/>
					<ToolButton
						label="Move down"
						icon={<DownIcon />}
						move="down"
						disabled={row.index === row.siblings - 1}
						onClick={() => onMove('down')}
					/>
					<ToolButton
						label="Move under the item above"
						icon={<IndentIcon />}
						move="in"
						disabled={row.index === 0}
						onClick={() => onMove('in')}
					/>
					<ToolButton
						label="Move out of its parent"
						icon={<OutdentIcon />}
						move="out"
						disabled={level === 1}
						onClick={() => onMove('out')}
					/>
					<ToolButton
						label="Add an item under it"
						icon={<PlusIcon />}
						disabled={level >= LIMITS.depth}
						onClick={onAddChild}
						data="add-child"
					/>
					<ToolButton label="Remove" icon={<TrashIcon />} onClick={onRemove} data="remove" />
				</div>
			)}
			{line && <span class="tm-drop-line" style={line} />}
		</li>
	);
}

function ToolButton(props: {
	label: string;
	icon: JSX.Element;
	onClick: () => void;
	disabled?: boolean;
	move?: string;
	data?: string;
}) {
	return (
		<button
			type="button"
			class="tm-button tm-button--icon"
			title={props.label}
			aria-label={props.label}
			disabled={props.disabled}
			data-tm-move={props.move}
			data-tm-tool={props.data ?? props.move}
			onClick={props.onClick}
		>
			{props.icon}
		</button>
	);
}
