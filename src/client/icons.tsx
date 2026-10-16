/** Small inline icons (24×24 strokes, drawn for Tapestry Menus). Decorative: buttons carry the label. */
import type { JSX } from 'preact';

const icon = (paths: JSX.Element) => () => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		focusable="false"
	>
		{paths}
	</svg>
);

export const GripIcon = icon(
	<>
		<circle cx="9" cy="6" r="1" />
		<circle cx="15" cy="6" r="1" />
		<circle cx="9" cy="12" r="1" />
		<circle cx="15" cy="12" r="1" />
		<circle cx="9" cy="18" r="1" />
		<circle cx="15" cy="18" r="1" />
	</>,
);
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);
export const UpIcon = icon(<path d="M12 19V5M6 11l6-6 6 6" />);
export const DownIcon = icon(<path d="M12 5v14M6 13l6 6 6-6" />);
export const IndentIcon = icon(<path d="M5 12h12M13 8l4 4-4 4M5 5v14" />);
export const OutdentIcon = icon(<path d="M19 12H7M11 8l-4 4 4 4M19 5v14" />);
export const TrashIcon = icon(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6L6 18" />);
