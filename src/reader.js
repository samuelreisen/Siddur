// Kindle-style reading controls: the Aa appearance sheet (text size, line spacing, margins, theme),
// the "Page 3 of 9" progress line, tap zones for turning pages, and reading mode (controls hidden).
// Built before tilt.js and app.js in the same script, so it shares `settings`, `saveSettings` and `applyTheme`.
/* global settings, saveSettings */

const LINE_HEIGHTS = { compact: 1.55, normal: 1.8, relaxed: 2.1 };
const MARGINS = { narrow: 16, medium: 28, wide: 44 };
const PAGE_PAD = { narrow: 20, medium: 30, wide: 42 }; // inner margin of the page card in the Pages layout
const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- paging (shared with tilt.js) ----------
// One page is a screen minus the sticky top bar and section index, with 48px of overlap so no line is skipped.
function pageStep() {
  const covered = document.getElementById('bar').offsetHeight + document.getElementById('toc').offsetHeight;
  return Math.max(200, window.innerHeight - covered - 48);
}

// dir > 0 is the next page, dir < 0 the previous one.
function turnPage(dir) {
  if (inPages()) return pagesTurn(dir);
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
  repaginate();
}

// Dragging a size slider fires many events, and each one re-flows all the text (about 70 ms here, several times that on a
// phone). Apply at most one change per 200 ms while dragging, and always apply the last value.
let sizeTimer = 0, sizeLast = -Infinity;
function setTextSizeSoon(v) {
  clearTimeout(sizeTimer);
  const wait = 200 - (performance.now() - sizeLast);
  const apply = () => { sizeLast = performance.now(); setTextSize(v); };
  if (wait <= 0) apply(); else sizeTimer = setTimeout(apply, wait);
}

function applyReadingLayout() {
  if (!(settings.lineHeight > 1)) settings.lineHeight = LINE_HEIGHTS.normal;
  if (!(settings.margin in MARGINS)) settings.margin = 'narrow';
  const root = document.documentElement.style;
  root.setProperty('--he-lh', String(settings.lineHeight));
  root.setProperty('--page-margin', MARGINS[settings.margin] + 'px');
  root.setProperty('--pg-pad', PAGE_PAD[settings.margin] + 'px');
  repaginate();
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
  closeContents(false);
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
  slider.addEventListener('input', () => setTextSizeSoon(slider.value));
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
    if (inPages()) { el.textContent = pagesProgressText(); return; }
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
  if (on) { closeSheet(false); closeContents(false); }
}

const TAP_BLOCK = 'summary, button, a, input, label, select, textarea, dialog, [role="dialog"], .sheet-backdrop, .toc, .bar, .tabbar';

function onTap(e) {
  if (!settings.tapTurn || e.defaultPrevented || e.button > 0) return;
  if (document.getElementById('view-pray').hidden || sheetOpen() || contentsOpen()) return;
  if (performance.now() < pg.noClickUntil) return; // the click that ends a swipe
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
  document.getElementById('read-progress').hidden = !pray; // hide now, not a frame later
  closeSheet(false);
  closeContents(false);
  setReadingMode(false);
  applyLayout();
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
  size.addEventListener('input', () => setTextSizeSoon(size.value));
  document.getElementById('sh-size').value = settings.size;
  if (settings.layout !== 'scroll') settings.layout = 'pages';
  applyReadingLayout();
  bindPages();
  applyLayout();
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  try { new ResizeObserver(updateProgress).observe(document.getElementById('service')); } catch (e) { /* no ResizeObserver */ }
  updateProgress();
}

// ================= Pages layout =================
// The Pray view (#view-pray) is one CSS multi-column box, one column per page, inside a fixed-height clip box.
// It is rtl, so page 1 is at the right and later pages continue to the left. A page is shown by moving the box
// with translateX (stride = column width + gap). repaginate() measures the page count and where every block lands
// with ONE forced layout, then goes back to the reader's place.
const pg = { i: 0, n: 1, stride: 0, colW: 0, h: 0, anchor: null, animUntil: 0, heads: [], pending: undefined, forceFirst: false, raf: 0, drag: null, noClickUntil: 0, lastMs: 0, ro: null };
const PG_BLOCKS = '.hero, .summary, h2.group, .sec > summary, .sec-note, .callout, .he p, .en p, .translit p, .foot p';
// Swipes may start on text rows (section titles, labels): the click that ends a swipe is suppressed, so nothing toggles.
const NO_SWIPE = 'input, button, a, select, textarea';
const $ = id => document.getElementById(id);

function inPages() { return settings.layout !== 'scroll' && !$('view-pray').hidden; }

// Called by showTab(), setLayout() and bindReader().
function applyLayout() {
  const on = inPages();
  document.body.classList.toggle('pg', on);
  $('pager').hidden = $('view-pray').hidden;
  $('toc-btn').hidden = !on;
  document.querySelectorAll('[data-layout]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.layout === settings.layout)));
  if (!on) closeContents(false);
  measureBars();
  if (on) repaginate();
}

function setLayout(mode) {
  settings.layout = mode === 'scroll' ? 'scroll' : 'pages';
  saveSettings();
  applyLayout();
  updateProgress();
}

function measureBars() {
  const h = $('bar').offsetHeight;
  if (h) document.documentElement.style.setProperty('--bar-h', h + 'px');
}

// keep: undefined = keep the reader's place; 'first' = go to page 1; an object from pagesBeforeRender() = that place.
function repaginate(keep, sync) {
  if (keep !== undefined) pg.pending = keep;
  if (sync) { if (pg.raf) { cancelAnimationFrame(pg.raf); pg.raf = 0; } paginateNow(); return; }
  if (pg.raf) return;
  pg.raf = requestAnimationFrame(() => { pg.raf = 0; paginateNow(); });
}

// Called at the start of render(), before the text is replaced. Returns what to keep.
function pagesBeforeRender() {
  if (pg.forceFirst) { pg.forceFirst = false; return 'first'; }
  if (pg.pending !== undefined && !inPages()) return pg.pending;
  captureAnchor();
  return describeAnchor(pg.anchor);
}
function pagesFirst() { pg.forceFirst = true; }

// The anchor is the first block at the top of the current page. It is looked up with a hit test while the layout
// is settled (after a turn or a measurement), so it is still known when a reflow has already moved everything.
function captureAnchor() {
  if (!inPages() || performance.now() < pg.animUntil) return;
  const c = $('page-clip').getBoundingClientRect();
  if (!c.width) return;
  const view = $('view-pray');
  for (let dy = 6; dy < 110; dy += 12) for (const f of [0.85, 0.5, 0.2]) {
    const el = document.elementFromPoint(c.left + c.width * f, c.top + dy);
    const b = el && view.contains(el) && el.closest(PG_BLOCKS);
    if (b) { pg.anchor = b; return; }
  }
}

function describeAnchor(el) {
  if (!el) return null;
  if (el.matches('h2.group')) return { head: el.textContent };
  if (el.closest('.foot')) return { foot: true };
  const sec = el.closest('details.sec');
  if (!sec || !sec.id) return null;
  const he = el.matches('.he p') ? [...sec.querySelectorAll('.he p')].indexOf(el) : -1;
  return { sec: sec.id, he };
}

function resolveAnchor(d) {
  if (!d) return null;
  if (d.foot) return document.querySelector('#view-pray .foot p');
  if (d.head) return [...document.querySelectorAll('#service h2.group')].find(h => h.textContent === d.head) || null;
  const sec = document.getElementById(d.sec);
  if (!sec) return null;
  if (d.he >= 0) { const ps = sec.querySelectorAll('.he p'); if (ps.length) return ps[Math.min(d.he, ps.length - 1)]; }
  return sec.querySelector('summary');
}

function paginateNow() {
  if (!inPages()) return;
  const t0 = performance.now();
  const view = $('view-pray'), clip = $('page-clip');
  const keep = pg.pending; pg.pending = undefined;
  const anchorEl = keep === 'first' ? null : keep === undefined ? pg.anchor : resolveAnchor(keep);

  // One forced layout: the first read below lays out the whole multi-column box. Everything after it is a read.
  const W = clip.clientWidth, H = clip.clientHeight;
  if (!W || !H) { pg.pending = keep; return; }
  const gap = 2 * PAGE_PAD[settings.margin];
  const stride = W + gap;
  const cr = view.getBoundingClientRect();
  const clipTop = clip.getBoundingClientRect().top;
  const pageOf = r => Math.max(0, Math.floor((cr.right - r.right + stride * 0.25) / stride));
  const heads = [];
  for (const el of view.querySelectorAll('h2.group')) {
    const r = el.getBoundingClientRect();
    if (r.width) heads.push({ el, text: el.textContent, page: pageOf(r), y: r.top - clipTop });
  }
  pg.n = Math.max(1, Math.round((view.scrollWidth + gap) / stride) || 1);
  pg.stride = stride; pg.colW = W; pg.h = H; pg.heads = heads;

  let page = keep === undefined ? Math.min(pg.i, pg.n - 1) : 0; // no usable anchor: stay on the same page number
  if (anchorEl && anchorEl.isConnected) {
    let r = anchorEl.getBoundingClientRect();
    if (!r.width && !r.height) { // it is inside a section that is now closed: use that section's title row
      const sm = anchorEl.closest('details.sec') && anchorEl.closest('details.sec').querySelector('summary');
      r = sm ? sm.getBoundingClientRect() : r;
    }
    if (r.width || r.height) { page = pageOf(r); pg.anchor = anchorEl; }
  }
  pg.i = Math.min(pg.n - 1, page);
  // Jump without sliding, then let the slide come back next frame.
  view.classList.add('no-anim');
  view.style.transform = `translateX(${pg.i * stride}px)`;
  pg.animUntil = 0;
  clearTimeout(pg.anchorTimer); pg.anchorTimer = setTimeout(captureAnchor, 80); // the hit test is slow right after a layout, so it waits
  requestAnimationFrame(() => view.classList.remove('no-anim'));
  renderPageUI();
  pg.lastMs = performance.now() - t0;
}

function serviceName() {
  const b = document.querySelector('[data-service][aria-pressed="true"]');
  return b ? b.textContent.trim() : 'Siddur';
}

// The running header: the first heading in the top part of the page, else the last heading before it.
function headerFor(i) {
  const name = serviceName();
  if (i === 0) return name;
  const lim = pg.h * 0.35;
  let h = pg.heads.find(x => x.page === i && x.y <= lim);
  if (!h) for (let k = pg.heads.length - 1; k >= 0; k--) if (pg.heads[k].page < i) { h = pg.heads[k]; break; }
  return h ? name + ' · ' + h.text : name;
}

function shortHebrewDate() {
  const t = ($('heb-date').textContent || '').trim().split(' ');
  return t.length > 2 ? t.slice(0, -1).join(' ') : t.join(' ');
}

function pagesProgressText() {
  const pct = pg.n > 1 ? Math.round(pg.i / (pg.n - 1) * 100) : 100;
  return `Page ${pg.i + 1} of ${pg.n} · ${pct}%`;
}

function renderPageUI() {
  $('ph-left').textContent = headerFor(pg.i);
  $('ph-right').textContent = shortHebrewDate();
  $('page-num').textContent = String(pg.i + 1);
  $('read-progress').textContent = pagesProgressText();
}

function goToPage(i, opts = {}) {
  i = Math.max(0, Math.min(pg.n - 1, i));
  if (i === pg.i && !opts.force) return false;
  pg.i = i;
  const view = $('view-pray');
  if (opts.instant) { view.classList.add('no-anim'); requestAnimationFrame(() => view.classList.remove('no-anim')); }
  view.style.transform = `translateX(${i * pg.stride}px)`;
  if (opts.instant) { pg.animUntil = 0; captureAnchor(); } else { pg.animUntil = performance.now() + 260; clearTimeout(pg.anchorTimer); pg.anchorTimer = setTimeout(captureAnchor, 270); }
  renderPageUI();
  if (opts.announce !== false) $('page-live').textContent = `Page ${i + 1} of ${pg.n}`;
  return true;
}

function pagesTurn(dir) {
  const to = pg.i + (dir > 0 ? 1 : -1);
  if (to < 0) return pageToast('First page');
  if (to >= pg.n) return pageToast('Last page');
  goToPage(to);
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* not available */ }
}

function pageOfElement(el) {
  const cr = $('view-pray').getBoundingClientRect(), r = el.getBoundingClientRect();
  return Math.max(0, Math.min(pg.n - 1, Math.floor((cr.right - r.right + pg.stride * 0.25) / pg.stride)));
}

// ---------- Contents sheet ----------
function contentsOpen() { return !$('contents-sheet').hidden; }

function openContents() {
  if (!inPages()) return;
  closeSheet(false);
  $('contents-list').innerHTML = pg.heads.map((h, k) =>
    `<button type="button" class="toc-row" data-head="${k}"><span>${esc(h.text)}</span><span class="toc-pg">p. ${h.page + 1}</span></button>`).join('');
  $('contents-sheet').hidden = false;
  $('contents-backdrop').hidden = false;
  $('toc-btn').setAttribute('aria-expanded', 'true');
  const first = $('contents-list').querySelector('button') || $('contents-done');
  first.focus();
}

function closeContents(restoreFocus = true) {
  if (!contentsOpen()) return;
  $('contents-sheet').hidden = true;
  $('contents-backdrop').hidden = true;
  const b = $('toc-btn');
  b.setAttribute('aria-expanded', 'false');
  if (restoreFocus && !b.hidden) b.focus();
}

// ---------- input: swipe, keys, focus ----------
function bindPages() {
  const clip = $('page-clip'), view = $('view-pray');
  $('toc-btn').addEventListener('click', () => (contentsOpen() ? closeContents() : openContents()));
  $('contents-done').addEventListener('click', () => closeContents());
  $('contents-backdrop').addEventListener('click', () => closeContents());
  $('contents-list').addEventListener('click', e => {
    const b = e.target.closest('[data-head]');
    if (!b) return;
    const h = pg.heads[Number(b.dataset.head)];
    closeContents(false);
    if (h) goToPage(h.page);
  });
  document.querySelectorAll('[data-layout]').forEach(b => b.addEventListener('click', () => setLayout(b.dataset.layout)));

  // Swipe: a finger moving right goes to the NEXT page (Hebrew book); moving left goes back.
  clip.addEventListener('pointerdown', e => {
    pg.drag = null;
    if (!inPages() || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest && e.target.closest(NO_SWIPE)) return;
    pg.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, state: 'wait', pts: [[e.timeStamp, e.clientX]] };
  });
  clip.addEventListener('pointermove', e => {
    const d = pg.drag;
    if (!d || d.id !== e.pointerId || d.state === 'no') return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.state === 'wait') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      pg.noClickUntil = performance.now() + 400; // it was a drag, not a tap
      if (Math.abs(dy) >= Math.abs(dx)) { d.state = 'no'; return; }
      d.state = 'drag';
      clip.classList.add('dragging');
      try { clip.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      try { getSelection().removeAllRanges(); } catch (err) { /* no selection API */ }
    }
    d.dx = dx;
    d.pts.push([e.timeStamp, e.clientX]);
    if (d.pts.length > 6) d.pts.shift();
    const edge = (pg.i === 0 && dx < 0) || (pg.i === pg.n - 1 && dx > 0);
    view.style.transform = `translateX(${pg.i * pg.stride + (edge ? dx * 0.25 : dx)}px)`;
  });
  const end = e => {
    const d = pg.drag;
    if (!d || d.id !== e.pointerId) return;
    pg.drag = null;
    if (d.state !== 'drag') return;
    pg.noClickUntil = performance.now() + 400;
    clip.classList.remove('dragging');
    try { clip.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    const first = d.pts.find(p => e.timeStamp - p[0] <= 120) || d.pts[0];
    const v = e.timeStamp > first[0] ? (e.clientX - first[1]) / (e.timeStamp - first[0]) : 0; // px per ms
    const dx = d.dx;
    const commit = e.type === 'pointerup' && (Math.abs(dx) > pg.colW * 0.2 || (Math.abs(dx) > 24 && Math.abs(v) > 0.5 && Math.sign(v) === Math.sign(dx)));
    const to = pg.i + (dx > 0 ? 1 : -1);
    if (commit && to >= 0 && to < pg.n) goToPage(to);
    else { view.style.transform = `translateX(${pg.i * pg.stride}px)`; if (commit) pageToast(to < 0 ? 'First page' : 'Last page'); }
  };
  clip.addEventListener('pointerup', end);
  clip.addEventListener('pointercancel', end);
  document.addEventListener('click', e => { if (performance.now() < pg.noClickUntil && clip.contains(e.target)) { e.stopPropagation(); e.preventDefault(); } }, true);

  // Keyboard.
  document.addEventListener('keydown', e => {
    if (contentsOpen()) {
      if (e.key === 'Escape') { e.preventDefault(); closeContents(); return; }
      if (e.key === 'Tab') {
        const items = [...$('contents-sheet').querySelectorAll('button')].filter(x => x.offsetParent !== null);
        if (!items.length) return;
        const f = items[0], l = items[items.length - 1], inside = $('contents-sheet').contains(document.activeElement);
        if (!inside) { e.preventDefault(); f.focus(); }
        else if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus(); }
        else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus(); }
      }
      return;
    }
    if (!inPages() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || sheetOpen()) return;
    const t = document.activeElement;
    if (t && t.closest && t.closest('input, textarea, select, dialog, [role="dialog"], [contenteditable="true"]')) return;
    const onControl = t && t.closest && t.closest('button, summary, a, [role="switch"]');
    let dir = 0, jump = -1;
    if (e.key === 'ArrowLeft' || e.key === 'PageDown') dir = 1;
    else if (e.key === 'ArrowRight' || e.key === 'PageUp') dir = -1;
    else if (e.key === ' ' || e.key === 'Spacebar') { if (onControl) return; dir = e.shiftKey ? -1 : 1; }
    else if (e.key === 'Home') jump = 0;
    else if (e.key === 'End') jump = pg.n - 1;
    else return;
    e.preventDefault();
    if (jump >= 0) goToPage(jump); else pagesTurn(dir);
  });

  // Tab key: show the page that holds the focused element, and never let the browser scroll the clip box.
  view.addEventListener('focusin', e => { if (inPages()) goToPage(pageOfElement(e.target), { instant: true }); clip.scrollLeft = 0; clip.scrollTop = 0; });
  clip.addEventListener('scroll', () => { clip.scrollLeft = 0; clip.scrollTop = 0; });

  // Reflow triggers.
  view.addEventListener('toggle', () => repaginate(), true);
  try {
    pg.ro = new ResizeObserver(() => { measureBars(); repaginate(); });
    pg.ro.observe(clip);
    pg.ro.observe($('bar'));
  } catch (e) { window.addEventListener('resize', () => { measureBars(); repaginate(); }); }
  window.addEventListener('orientationchange', () => repaginate());
  try {
    if (document.fonts) { document.fonts.ready.then(() => repaginate()); document.fonts.addEventListener('loadingdone', () => repaginate()); }
  } catch (e) { /* no font events */ }
}
