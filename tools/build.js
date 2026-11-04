// Builds the single-file siddur.
//   siddur.html      page body for the claude.ai artifact (the host adds <html>/<head>)
//   dist/index.html  standalone page (used by the Android app and any browser)
// Usage: node tools/build-data.js && node tools/build.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');

const data = read('data.json').replace(/<\//g, '<\\/');
const js = read('calendar.js') + '\n' + read('app.js');
const page = read('index.html')
  .replace('/*CSS*/', () => read('app.css'))
  .replace('/*DATA*/', () => 'const SIDDUR_DATA = ' + data + ';')
  .replace('/*JS*/', () => js);

fs.writeFileSync(path.join(ROOT, 'siddur.html'), page);
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
// Put everything from <header> onward in <body>; keep the <head> tags above it.
const headEnd = page.indexOf('<header class="bar">');
const doc = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<meta name="color-scheme" content="light dark">\n' + page.slice(0, headEnd) + '</head>\n<body>\n' + page.slice(headEnd) + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(ROOT, 'dist', 'index.html'), doc);
console.log('siddur.html', fs.statSync(path.join(ROOT, 'siddur.html')).size, 'bytes; dist/index.html', doc.length, 'chars');
