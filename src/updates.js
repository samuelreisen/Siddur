// App Updates screen. Only shown inside the Android app, which provides window.SiddurApp (see android/.../UpdateBridge.kt).
// The app answers long-running calls by calling window.siddurAppEvent(type, json).
// Nothing is downloaded until the person taps.

const nativeApp = window.SiddurApp || null;

function appInfo() {
  try { return JSON.parse(nativeApp.info()); } catch (e) { return null; }
}

function setUpdateResult(title, sub, installMark) {
  document.getElementById('upd-result-row').hidden = !title;
  document.getElementById('upd-result-title').textContent = title || '';
  document.getElementById('upd-result-sub').textContent = sub || '';
  const btn = document.getElementById('upd-install');
  btn.hidden = !installMark;
  btn.dataset.mark = installMark ? String(installMark) : '';
  btn.disabled = false;
}

function setBusy(busy) {
  for (const id of ['upd-check', 'upd-file', 'upd-install']) document.getElementById(id).disabled = busy;
  document.querySelectorAll('[data-use-mark]').forEach(b => { b.disabled = busy; });
}

function renderUpdateInfo() {
  const info = appInfo();
  if (!info) return;
  const cur = info.current;
  document.getElementById('upd-current').textContent =
    `${cur.name}${cur.title ? ' · ' + cur.title : ''}${cur.builtIn ? ' (built in)' : ''} · app ${info.shell}`;
  const list = document.getElementById('upd-list');
  const rows = [{ mark: 0, name: `Built-in (${info.bundled.name})`, title: 'Came with this app' }].concat(info.installed);
  list.innerHTML = rows.map(r => {
    const inUse = r.mark === 0 ? cur.builtIn : (!cur.builtIn && r.mark === cur.mark);
    return `<div class="row">
      <span class="row-text"><span class="row-label">${esc(r.name)}</span><span class="row-sub">${esc(r.title || '')}</span></span>
      ${inUse ? '<span class="badge">In use</span>' : `<button type="button" class="btn-plain" data-use-mark="${r.mark}">Use This Version</button>`}
    </div>`;
  }).join('');
}

function formatSize(bytes) {
  return bytes ? (bytes / 1048576).toFixed(1) + ' MB' : '';
}

window.siddurAppEvent = function (type, json) {
  let r;
  try { r = JSON.parse(json); } catch (e) { r = { status: 'error', message: 'The app sent an unreadable answer.' }; }
  setBusy(false);
  if (type === 'check') {
    if (r.status === 'uptodate') setUpdateResult('Siddur is up to date', `${r.name} is the newest version.`);
    else if (r.status === 'available') setUpdateResult(`${r.name} is available`, [r.title, r.notes, formatSize(r.bytes)].filter(Boolean).join(' · '), r.mark);
    else if (r.status === 'needsApp') setUpdateResult(`${r.name} needs a newer app`, `Install the latest APK from GitHub first (needs app ${r.minShell}, you have ${r.shell}).`);
    else setUpdateResult('Couldn’t check for updates', r.message || 'Check your connection and try again.');
  } else if (type === 'install') {
    if (r.status === 'installed') setUpdateResult(`Installed ${r.name}`, 'Reloading…');
    else if (r.status === 'cancelled') setUpdateResult('', '');
    else setUpdateResult('Couldn’t install the update', r.message || 'Try again.');
    renderUpdateInfo();
  } else if (type === 'progress') {
    setBusy(true);
    setUpdateResult(r.title || 'Working…', r.sub || '');
  }
};

function bindUpdates() {
  if (!nativeApp) return;
  document.getElementById('updates-group').hidden = false;
  renderUpdateInfo();
  document.getElementById('upd-check').addEventListener('click', () => {
    setBusy(true);
    setUpdateResult('Checking…', 'Looking for a newer version on GitHub.');
    nativeApp.check();
  });
  document.getElementById('upd-install').addEventListener('click', e => {
    const mark = Number(e.currentTarget.dataset.mark);
    if (!mark) return;
    setBusy(true);
    setUpdateResult('Downloading…', 'Keep the app open.');
    nativeApp.install(mark);
  });
  document.getElementById('upd-file').addEventListener('click', () => nativeApp.pickFile());
  document.getElementById('upd-list').addEventListener('click', e => {
    const b = e.target.closest('[data-use-mark]');
    if (!b) return;
    setBusy(true);
    nativeApp.use(Number(b.dataset.useMark));
  });
}
