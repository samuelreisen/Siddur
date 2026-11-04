// Downloads the Siddur Ashkenaz (Metsudah, CC-BY) and two psalms from the Sefaria API into data/.
// Usage: node tools/fetch-sefaria.js
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'data');
const API = 'https://www.sefaria.org/api';

async function getJSON(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
    }
  }
  return null;
}

function leafRefs(schema) {
  const out = [];
  (function walk(n, trail) {
    const t = (n.titles || []).find(x => x.lang === 'en' && x.primary);
    const name = n.key === 'default' ? '' : (t ? t.text : n.key);
    const next = name ? [...trail, name] : trail;
    if (n.nodes) n.nodes.forEach(c => walk(c, next));
    else out.push(next.join(', '));
  })(schema, []);
  return out;
}

(async () => {
  const index = await getJSON(API + '/v2/raw/index/Siddur_Ashkenaz');
  const refs = leafRefs(index.schema);
  const out = {};
  const queue = [...refs];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const ref = queue.shift();
      const d = await getJSON(API + '/v3/texts/' + encodeURIComponent(ref) + '?version=hebrew&version=english');
      if (!d) { console.error('failed:', ref); continue; }
      const he = d.versions.find(v => v.language === 'he');
      const en = d.versions.find(v => v.language === 'en');
      out[ref.replace(/^Siddur Ashkenaz, /, '')] = { he: he ? he.text : null, en: en ? en.text : null };
    }
  }));
  fs.writeFileSync(path.join(DATA, 'raw-siddur-ashkenaz.json'), JSON.stringify(out));
  fs.writeFileSync(path.join(DATA, 'order.txt'), refs.map(r => r.replace(/^Siddur Ashkenaz, /, '')).join('\n') + '\n');
  for (const p of [49, 16]) {
    const d = await getJSON(API + `/v3/texts/Psalms.${p}?version=hebrew%7CMiqra%20according%20to%20the%20Masorah&version=english%7CThe%20Holy%20Scriptures%3A%20A%20New%20Translation%20(JPS%201917)`);
    fs.writeFileSync(path.join(DATA, `raw-psalm-${p}.json`), JSON.stringify(d));
  }
  console.log('sections:', refs.length, 'downloaded:', Object.keys(out).length);
})();
