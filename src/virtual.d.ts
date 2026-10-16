// Tapestry's build-time modules this plugin uses (Tapestry is required, and both plugins run in the same
// Vite build). Only the parts used here are declared.

declare module 'virtual:tapestry/config' {
	const config: { pageUrlPattern: string; languages: Array<{ code: string; label: string }> };
	export default config;
}
