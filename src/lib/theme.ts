export const THEME_STORAGE_KEY = "cg-theme";
export const THEME_CHANGE_EVENT = "cg-theme-change";
export type Theme = "light" | "dark" | "system";

/**
 * Inlined in <head> (with the request's CSP nonce) so the correct theme is applied before
 * first paint. Black is the default; the diamond-white theme applies only when a member picks
 * it (or picks "System" on a device set to light).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t!=='light'&&(t!=='system'||window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
