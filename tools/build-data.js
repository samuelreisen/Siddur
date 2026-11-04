// Trims the raw Sefaria download to the sections the app uses and writes src/data.json.
// Usage: node tools/build-data.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'raw-siddur-ashkenaz.json'), 'utf8'));
const order = fs.readFileSync(path.join(ROOT, 'data', 'order.txt'), 'utf8').trim().split('\n');

const KEEP = /^(Weekday, |Shabbat, |Festivals, Rosh Chodesh|Festivals, Shalosh Regalim|Festivals, Sukkot, Blessing on Lulav|Festivals, Chanukah|Kaddish, )/;
const DROP = /Zemirot|Daytime Meal|Third Meal|Bat Mitzvah/;

const flat = v => (v == null ? [] : [v].flat(Infinity)).map(x => String(x).trim()).filter(Boolean);

const sections = [];
for (const k of order) {
  if (!KEEP.test(k) || DROP.test(k) || !raw[k]) continue;
  const he = flat(raw[k].he);
  if (!he.length) continue;
  sections.push({ k, he, en: flat(raw[k].en) });
}

// Shabbat sections often lack English; borrow it from the weekday section with the same name
// when both have the same number of paragraphs.
const byKey = Object.fromEntries(sections.map(s => [s.k, s]));
for (const s of sections) {
  if (s.en.length || !s.k.startsWith('Shabbat, ')) continue;
  const twin = byKey[s.k.replace(/^Shabbat, /, 'Weekday, ')];
  if (twin && twin.en.length && twin.he.length === s.he.length) s.en = twin.en;
}

// Psalms: strip cantillation marks, keep vowels.
const stripTaamim = s => s.replace(/&thinsp;<small>\u05C0<\/small>&thinsp;/g, ' ').replace(/[\u0591-\u05AF\u05BD\u05C0]/g, '').replace(/\s+/g, ' ').trim();
const psalms = {};
for (const p of [49, 16]) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `raw-psalm-${p}.json`), 'utf8'));
  const he = d.versions.find(v => v.language === 'he');
  const en = d.versions.find(v => v.language === 'en');
  psalms[p] = { he: flat(he.text).map(stripTaamim), en: flat(en.text) };
}

fs.writeFileSync(path.join(ROOT, 'src', 'data.json'), JSON.stringify({ sections, psalms }));
console.log('kept sections:', sections.length, 'bytes:', fs.statSync(path.join(ROOT, 'src', 'data.json')).size);
