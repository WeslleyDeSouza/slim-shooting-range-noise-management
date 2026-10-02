// Applies the stored theme before the first paint (no light→dark flash). Loaded by index.html as a
// blocking script; same key and attributes as SlimThemeService (@ui-slim/design-system).
(function () {
  try {
    const mode = localStorage.getItem('slim.theme');
    // Default is light; 'system' follows the OS only when chosen explicitly.
    const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement;
    if (mode !== 'system') root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
  } catch {
    /* private mode: CSS falls back to prefers-color-scheme */
  }
})();
