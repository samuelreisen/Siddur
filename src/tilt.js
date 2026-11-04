// Tilt to turn pages: a firm flick of the phone to the left scrolls forward one screen, to the right scrolls back.
// Slow tilting, single bumps, motion while a finger is on the screen and the swing back after a turn are ignored.
/* global settings, saveSettings */

const TILT_THRESHOLDS = { firm: 200, hard: 300, veryhard: 420 }; // rotation speed in degrees per second
const TILT_SAMPLES = 2;      // readings in a row past the threshold before a turn
const TILT_COOLDOWN = 1000;  // ms after a turn when all motion is ignored (covers the swing back)

const tilt = { listening: false, run: 0, dir: 0, lastTurn: -Infinity, touching: false, seen: false, checked: false };

function screenAngle() {
  const a = screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : (window.orientation || 0);
  return ((a % 360) + 360) % 360;
}

// Rotation speed in degrees per second: negative is a tilt to the left, positive to the right.
// Counts either a twist (turning the screen to face left or right) or a steer (rotating it like a wheel),
// whichever is stronger.
function tiltRate(r) {
  const angle = screenAngle();
  const twist = angle === 0 ? r.gamma : angle === 180 ? -r.gamma : angle === 90 ? r.beta : -r.beta;
  const steer = -r.alpha; // counterclockwise (to the left) is positive alpha
  return Math.abs(twist) >= Math.abs(steer) ? twist : steer;
}

function onMotion(e) {
  const r = e.rotationRate;
  if (!r || (r.alpha == null && r.beta == null && r.gamma == null)) return;
  tilt.seen = true;
  const now = performance.now();
  if (!settings.tilt || tilt.touching || document.hidden || document.getElementById('view-pray').hidden || now - tilt.lastTurn < TILT_COOLDOWN) {
    tilt.run = 0;
    return;
  }
  const threshold = TILT_THRESHOLDS[settings.tiltStrength] || TILT_THRESHOLDS.hard;
  const v = tiltRate({ alpha: r.alpha || 0, beta: r.beta || 0, gamma: r.gamma || 0 });
  const dir = v <= -threshold ? 1 : v >= threshold ? -1 : 0; // left = next page, right = previous page
  if (!dir) { tilt.run = 0; tilt.dir = 0; return; }
  if (dir !== tilt.dir) { tilt.dir = dir; tilt.run = 0; }
  if (++tilt.run >= TILT_SAMPLES) {
    tilt.run = 0;
    tilt.dir = 0;
    tilt.lastTurn = now;
    turnPage(dir);
  }
}

function turnPage(dir) {
  const covered = document.getElementById('bar').offsetHeight + document.getElementById('toc').offsetHeight;
  const step = Math.max(200, window.innerHeight - covered - 48); // keep a little overlap so no line is skipped
  const maxY = document.documentElement.scrollHeight - window.innerHeight;
  if (dir < 0 && window.scrollY <= 1) return pageToast('Already at the top');
  if (dir > 0 && window.scrollY >= maxY - 1) return pageToast('End of the service');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollBy({ top: dir * step, behavior: reduce ? 'auto' : 'smooth' });
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

function startTilt() {
  if (!settings.tilt || tilt.listening) return;
  if (!('DeviceMotionEvent' in window)) { tilt.checked = true; updateTiltUI(); return; }
  window.addEventListener('devicemotion', onMotion);
  tilt.listening = true;
  setTimeout(() => { tilt.checked = true; updateTiltUI(); }, 2500);
}

async function setTilt(on) {
  // iPhone and iPad Safari ask for permission, and only from a tap. Chrome-based browsers may answer "prompt"
  // without asking; keep listening then, and let the sensor check below report if no readings arrive.
  if (on && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    try { if (await DeviceMotionEvent.requestPermission() === 'denied') on = false; } catch (e) { /* keep on; the sensor check decides */ }
  }
  settings.tilt = on;
  saveSettings();
  startTilt();
  updateTiltUI();
}

function updateTiltUI() {
  document.getElementById('opt-tilt').checked = !!settings.tilt;
  document.getElementById('tilt-strength-row').hidden = !settings.tilt;
  document.querySelectorAll('[data-strength]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.strength === (settings.tiltStrength || 'hard'))));
  const status = document.getElementById('tilt-status');
  status.textContent = settings.tilt && tilt.checked && !tilt.seen
    ? 'Motion sensors aren’t available here. Tilt works in the Android app and in a phone browser.'
    : '';
}

function bindTilt() {
  document.getElementById('opt-tilt').addEventListener('change', e => setTilt(e.target.checked));
  document.querySelectorAll('[data-strength]').forEach(b => b.addEventListener('click', () => {
    settings.tiltStrength = b.dataset.strength;
    saveSettings();
    updateTiltUI();
  }));
  const down = () => { tilt.touching = true; };
  const up = e => { if (!e.touches || e.touches.length === 0) tilt.touching = false; };
  document.addEventListener('touchstart', down, { passive: true });
  document.addEventListener('touchend', up, { passive: true });
  document.addEventListener('touchcancel', up, { passive: true });
  startTilt();
  updateTiltUI();
}
