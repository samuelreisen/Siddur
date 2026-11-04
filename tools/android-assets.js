// Copies the built page into the Android app and points it at the bundled font,
// since the app works offline and has no internet permission.
// Usage: node tools/build.js && node tools/android-assets.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8');
const out = src
  .replace(/<link rel="preconnect"[^>]*>\n?/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link rel="stylesheet" href="fonts/fonts.css">');
if (out.includes('fonts.googleapis.com')) throw new Error('Google Fonts link not replaced');
const dest = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'index.html');
fs.writeFileSync(dest, out);
console.log('wrote', path.relative(ROOT, dest), out.length, 'chars');
