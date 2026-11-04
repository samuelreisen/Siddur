// Kindle-style reading controls: the Aa appearance sheet (text size, line spacing, margins, theme),
// the "Page 3 of 9" progress line, tap zones for turning pages, and reading mode (controls hidden).
// Built before tilt.js and app.js in the same script, so it shares `settings`, `saveSettings` and `applyTheme`.
/* global settings, saveSettings */

const LINE_HEIGHTS = { compact: 1.55, normal: 1.8, relaxed: 2.1 };
const MARGINS = { narrow: 16, medium: 28, wide: 44 };
const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- paging (shared with tilt.js) ----------
// One page is a screen minus the sticky top bar and section index, with 48px of overlap so no line is skipped.
function pageStep() {
  const covered = document.getElementById('bar').offsetHeight + document.getElementById('toc').offsetHeight;
  return Math.max(200, window.innerHeight - covered - 48);
}

// dir > 0 is the next page, dir < 0 the previous one.
function turnPage(dir) {
  const step = pageStep();
  const maxY = document.documentElement.scrollHeight - window.innerHeight;
  if (dir < 0 && window.scrollY <= 1) return pageToast('Already at the top');
  if (dir > 0 && window.scrollY >= maxY - 1) return pageToast('End of the service');
  window.scrollBy({ top: dir * step, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  pageToast(dir > 0 ? 'Next page' : 'Previous page');
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* not available */ }
}

let toastTimer = 0;
function pageToast(text) {
  const el = document.getElementById('page-toast');
  el.textContent = text;
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth; // restart the fade
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; el.classList.remove('show'); }, 1100);
}

// ---------- text size, line spacing, margins ----------
function clampSize(v) { return Math.min(2.2, Math.max(1, Math.round(v * 20) / 20)); }

function setTextSize(v) {
  settings.size = clampSize(Number(v) || 1.25);
  saveSettings();
  document.documentElement.style.setProperty('--he-size', settings.size + 'rem');
  for (const id of ['opt-size', 'sh-size']) { const el = document.getElementById(id); if (el && Number(el.value) !== settings.size) el.value = settings.size; }
  updateProgress();
}

function applyReadingLayout() {
  if (!(settings.lineHeight > 1)) settings.lineHeight = LINE_HEIGHTS.normal;
  if (!(settings.margin in MARGINS)) settings.margin = 'narrow';
  const root = document.documentElement.style;
  root.setProperty('--he-lh', String(settings.lineHeight));
  root.setProperty('--page-margin', MARGINS[settings.margin] + 'px');
  document.querySelectorAll('[data-lh]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.lh) === settings.lineHeight)));
  document.querySelectorAll('[data-margin]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.margin === settings.margin)));
  updateProgress();
}

// ---------- the Aa sheet ----------
function sheetOpen() { return !document.getElementById('appearance-sheet').hidden; }

function openSheet() {
  if (document.getElementById('view-pray').hidden) return;
  document.getElementById('appearance-sheet').hidden = false;
  document.getElementById('sheet-backdrop').hidden = false;
  document.getElementById('aa-btn').setAttribute('aria-expanded', 'true');
  const active = document.querySelector('.swatch[aria-pressed="true"]') || document.getElementById('sheet-done');
  active.focus();
}

function closeSheet(restoreFocus = true) {
  if (!sheetOpen()) return;
  document.getElementById('appearance-sheet').hidden = true;
  document.getElementById('sheet-backdrop').hidden = true;
  const aa = document.getElementById('aa-btn');
  aa.setAttribute('aria-expanded', 'false');
  if (restoreFocus && !aa.hidden) aa.focus();
}

function bindSheet() {
  document.getElementById('aa-btn').addEventListener('click', () => (sheetOpen() ? closeSheet() : openSheet()));
  document.getElementById('sheet-done').addEventListener('click', () => closeSheet());
  document.getElementById('sheet-backdrop').addEventListener('click', () => closeSheet());
  document.addEventListener('keydown', e => {
    if (!sheetOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
    if (e.key !== 'Tab') return;
    // Keep keyboard focus inside the modal sheet.
    const items = [...document.querySelectorAll('#appearance-sheet button, #appearance-sheet input')].filter(el => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const inside = document.getElementById('appearance-sheet').contains(document.activeElement);
    if (!inside) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  const slider = document.getElementById('sh-size');
  slider.value = settings.size;
  slider.addEventListener('input', () => setTextSize(slider.value));
  document.getElementById('sh-size-down').addEventListener('click', () => setTextSize(settings.size - 0.1));
  document.getElementById('sh-size-up').addEventListener('click', () => setTextSize(settings.size + 0.1));
  document.querySelectorAll('[data-lh]').forEach(b => b.addEventListener('click', () => { settings.lineHeight = Number(b.dataset.lh); saveSettings(); applyReadingLayout(); }));
  document.querySelectorAll('[data-margin]').forEach(b => b.addEventListener('click', () => { settings.margin = b.dataset.margin; saveSettings(); applyReadingLayout(); }));
}

// ---------- progress line ----------
let progressQueued = false;
function updateProgress() {
  if (progressQueued) return;
  progressQueued = true;
  requestAnimationFrame(() => {
    progressQueued = false;
    const el = document.getElementById('read-progress');
    const pray = !document.getElementById('view-pray').hidden;
    el.hidden = !pray;
    if (!pray) return;
    const step = pageStep();
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const y = Math.min(maxY, Math.max(0, window.scrollY));
    const pages = Math.max(1, Math.ceil(maxY / step) + 1);
    const page = y >= maxY - 1 ? pages : Math.min(pages, Math.floor(y / step + 0.02) + 1);
    const pct = maxY > 0 ? Math.round(y / maxY * 100) : 100;
    el.textContent = `Page ${page} of ${pages} · ${pct}%`;
  });
}

// ---------- reading mode and tap zones ----------
function setReadingMode(on) {
  document.body.classList.toggle('reading-mode', !!on);
  if (on) closeSheet(false);
}

const TAP_BLOCK = 'summary, button, a, input, label, select, textarea, dialog, [role="dialog"], .sheet-backdrop, .toc, .bar, .tabbar';

function onTap(e) {
  if (!settings.tapTurn || e.defaultPrevented || e.button > 0) return;
  if (document.getElementById('view-pray').hidden || sheetOpen()) return;
  const t = e.target;
  if (!(t instanceof Element) || t.closest(TAP_BLOCK)) return;
  const sel = window.getSelection && window.getSelection();
  if (sel && sel.toString().length) return; // finishing a text selection, not a tap
  const w = document.documentElement.clientWidth || window.innerWidth;
  const x = e.clientX;
  if (x < w * 0.25) turnPage(1);            // Hebrew reads right to left: the left edge goes forward
  else if (x > w * 0.75) turnPage(-1);
  else setReadingMode(!document.body.classList.contains('reading-mode'));
}

// Called by showTab() in app.js.
function onTabChange(tab) {
  const pray = tab === 'pray';
  document.getElementById('aa-btn').hidden = !pray;
  closeSheet(false);
  setReadingMode(false);
  updateProgress();
}

function bindReader() {
  const tap = document.getElementById('opt-tapTurn');
  tap.checked = !!settings.tapTurn;
  tap.addEventListener('change', () => {
    settings.tapTurn = tap.checked;
    saveSettings();
    if (!tap.checked) setReadingMode(false);
  });
  document.addEventListener('click', onTap);
  bindSheet();
  const size = document.getElementById('opt-size');
  size.value = settings.size;
  size.addEventListener('input', () => setTextSize(size.value));
  document.getElementById('sh-size').value = settings.size;
  applyReadingLayout();
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  try { new ResizeObserver(updateProgress).observe(document.getElementById('service')); } catch (e) { /* no ResizeObserver */ }
  updateProgress();
}
