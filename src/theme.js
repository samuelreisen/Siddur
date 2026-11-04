// Appearance modes: Light, Paper, Dark and Auto. The page always carries a concrete data-reading value
// ('light' | 'paper' | 'dark'), never 'auto'. We do not touch data-theme: the claude.ai host owns that attribute.
// Auto follows the host's data-theme if it has one, otherwise the system color scheme (never Paper).
/* global settings, saveSettings */

const THEME_MODES = ['auto', 'light', 'paper', 'dark'];
const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function resolveReading(mode) {
  if (mode === 'light' || mode === 'paper' || mode === 'dark') return mode;
  const host = document.documentElement.getAttribute('data-theme');
  if (host === 'dark' || host === 'light') return host;
  return darkQuery && darkQuery.matches ? 'dark' : 'light';
}

function applyTheme() {
  if (THEME_MODES.indexOf(settings.theme) < 0) settings.theme = 'auto';
  document.documentElement.dataset.reading = resolveReading(settings.theme);
  document.querySelectorAll('[data-theme-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeMode === settings.theme)));
  // Tell the Android app which mode was chosen so it can paint its window and system bars to match.
  try {
    if (window.SiddurApp && typeof window.SiddurApp.setAppearance === 'function') window.SiddurApp.setAppearance(settings.theme);
  } catch (e) { /* the app is not ready or does not support it */ }
}

function setTheme(mode) {
  settings.theme = THEME_MODES.indexOf(mode) < 0 ? 'auto' : mode;
  saveSettings();
  applyTheme();
}

function bindTheme() {
  document.querySelectorAll('[data-theme-mode]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themeMode)));
  const again = () => { if (settings.theme === 'auto') applyTheme(); };
  if (darkQuery) {
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', again); else if (darkQuery.addListener) darkQuery.addListener(again);
  }
  try {
    new MutationObserver(again).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (e) { /* no MutationObserver */ }
  applyTheme();
}
