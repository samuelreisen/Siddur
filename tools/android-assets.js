// Copies the built page into the Android app and points it at the bundled font, since the app works offline.
// Also writes assets/bundled-mark.json from mark.json, so the app knows which Mk it has built in
// (the updater compares it with downloaded updates).
// Usage: node tools/build.js && node tools/android-assets.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets');

const src = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8');
const out = src
  .replace(/<link rel="preconnect"[^>]*>\n?/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="fonts/fonts.css">');
if (out.includes('fonts.googleapis.com')) throw new Error('Google Fonts link not replaced');
fs.writeFileSync(path.join(ASSETS, 'index.html'), out);
console.log('wrote android/app/src/main/assets/index.html', out.length, 'chars');

const markPath = path.join(ROOT, 'mark.json');
const mark = fs.existsSync(markPath) ? JSON.parse(fs.readFileSync(markPath, 'utf8')) : { mark: 0, name: 'Built-in', title: '' };
const bundled = { mark: mark.mark, name: mark.name, title: mark.title };
fs.writeFileSync(path.join(ASSETS, 'bundled-mark.json'), JSON.stringify(bundled) + '\n');
console.log('wrote android/app/src/main/assets/bundled-mark.json', JSON.stringify(bundled));
