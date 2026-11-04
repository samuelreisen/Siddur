// Siddur app: picks the right service for the day and shows or hides each insert by its label.
/* global SIDDUR_DATA, dayFacts, dayLabels, hdate, hebrewDateHe, addDays, utcNoon, isoDate, fromIso, isLeapYear, bindTilt, bindUpdates, bindTheme, bindReader, onTabChange, setTextSize */

const SECTIONS = SIDDUR_DATA.sections;
const BY_KEY = Object.fromEntries(SECTIONS.map(s => [s.k, s]));
const keysUnder = prefix => SECTIONS.filter(s => s.k.startsWith(prefix)).map(s => s.k);

// ---------- settings ----------
const DEFAULTS = {
  mourner: false, minyan: true, shiva: false, israel: false, female: false,
  sayTal: false, english: false, notes: false, translit: true, size: 1.25,
  tilt: false, tiltStrength: 'hard',
  theme: 'auto', lineHeight: 1.8, margin: 'narrow',
  tapTurn: !!window.SiddurApp // edge taps turn pages by default in the Android app only
};
function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('siddur.settings') || '{}'); } catch (e) { saved = {}; }
  const s = Object.assign({}, DEFAULTS, saved);
  if (!('israel' in saved)) {
    try { s.israel = /Jerusalem|Tel_Aviv/.test(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (e) { /* keep default */ }
    s.sayTal = s.israel;
  }
  return s;
}
function saveSettings() { try { localStorage.setItem('siddur.settings', JSON.stringify(settings)); } catch (e) { /* storage blocked */ } }
let settings = loadSettings();
let state = { date: null, service: null };

// ---------- which day and service ----------
function todayCivil() { const n = new Date(); return utcNoon(n.getFullYear(), n.getMonth(), n.getDate()); }
function autoService() {
  const hr = new Date().getHours();
  return hr < 12 ? 'shacharit' : hr < 17 ? 'mincha' : 'maariv';
}

// Maariv belongs to the coming Hebrew day, so it uses tomorrow's date (except just after midnight).
function context() {
  const civil = state.date || todayCivil();
  const service = state.service || autoService();
  const lateNight = !state.date && new Date().getHours() < 4;
  const ctxDate = service === 'maariv' && !lateNight ? addDays(civil, 1) : civil;
  const c = dayFacts(ctxDate, settings.israel);
  const prev = dayFacts(addDays(ctxDate, -1), settings.israel);
  const next = dayFacts(addDays(ctxDate, 1), settings.israel);
  Object.assign(c, {
    civil, ctxDate, service, prev, next,
    minyan: settings.minyan, female: settings.female, mourner: settings.mourner, shiva: settings.shiva,
    sayTal: settings.sayTal
  });
  c.motzeiShabbat = service === 'maariv' && prev.shabbat && !c.yomTov;
  c.motzeiYomTov = service === 'maariv' && prev.yomTov && !c.yomTov && !c.shabbat && !prev.shabbat;
  c.fridayNight = service === 'maariv' && c.shabbat;
  // Tachanun: never at Maariv, never in a shiva house; at Mincha also skipped before Shabbat or a no-Tachanun day.
  c.tachanun = service !== 'maariv' && !c.noTachanunDay && !c.shiva &&
    !(service === 'mincha' && (c.dow === 5 || c.next.noTachanunDay));
  c.mevarchim = c.shabbat && [1, 2, 3, 4, 5, 6, 7].some(k => {
    const f = dayFacts(addDays(ctxDate, k), settings.israel);
    return f.h.d === 1 && f.h.m !== 'Tishrei' || (f.h.d === 30 && k < 7);
  }) && c.h.m !== 'Elul';
  c.avinuMalkeinu = (c.tenDays && c.h.d !== 9 && !c.roshHashana) || (c.fast && !c.av9);
  if (service === 'mincha' && c.dow === 5) c.avinuMalkeinu = false;
  c.mode = (c.roshHashana || c.yomKippur) ? 'highHoliday' : c.yomTov ? 'yomTov' : c.shabbat ? 'shabbat' : 'weekday';
  return c;
}

// ---------- building the service ----------
// Each item: { k (section key) | special, when?(c), collapsed?(c), note? }
const every = () => true;
const sec = (k, when = every, extra = {}) => Object.assign({ k, when }, extra);
const many = (prefix, rules = []) => keysUnder(prefix).map(k => {
  const r = rules.find(([re]) => re.test(k));
  return r ? sec(k, r[1], r[2] || {}) : sec(k);
});
const OPTIONAL = { optional: true };

function weekdayShacharit(c) {
  const parts = [];
  parts.push(...many('Weekday, Shacharit, Preparatory Prayers', [
    [/Tefillin/, c => !c.av9 && !c.cholHamoed, { noteFn: c => c.cholHamoed ? 'Customs differ on tefillin during Chol Hamoed.' : '' }],
    [/Akedah|Sovereignty|Korbanot|Torah Study|Adon Olam|Yigdal/, every, OPTIONAL]
  ]));
  parts.push(...many('Weekday, Shacharit, Pesukei Dezimra', [
    [/Mizmor Letoda/, c => !c.cholHamoedPesach && !(c.h.m === 'Nisan' && c.h.d === 14) && !(c.h.m === 'Tishrei' && c.h.d === 9)],
    [/Psalm 130/, c => c.tenDays]
  ]));
  parts.push(...many('Weekday, Shacharit, Blessings of the Shema'));
  parts.push(...many('Weekday, Shacharit, Amidah'));
  parts.push(...many('Weekday, Shacharit, Post Amidah', [
    [/Vidui/, c => c.tachanun && (c.fast || c.tenDays)],
    [/Avinu Malkenu/, c => c.avinuMalkeinu],
    [/Monday and Thursday/, c => c.tachanun && (c.dow === 1 || c.dow === 4)],
    [/Tachanun, Half Kaddish/, c => c.tachanun],
    [/Tachanun/, c => c.tachanun]
  ]));
  parts.push({ special: 'hallel', when: c => c.hallel });
  parts.push(...many('Weekday, Shacharit, Torah Reading', [[/./, c => c.torahReading]]));
  parts.push(...many('Weekday, Shacharit, Concluding Prayers', [
    [/Lamenatze/, c => !c.noTachanunDay && !c.shiva],
    [/Barchi Nafshi/, c => c.roshChodesh],
    [/LeDavid/, c => c.elul],
    [/Korbanot \(Israel\)/, c => c.israel, OPTIONAL],
    [/Uva Letzion/, every, { musafAfter: true }]
  ]));
  parts.push({ special: 'shiva', when: c => c.shiva });
  parts.push(...many('Weekday, Shacharit, Post Service', [[/./, every, OPTIONAL]]));
  return parts;
}

function weekdayMincha() {
  return many('Weekday, Minchah', [
    [/Vidui/, c => c.tachanun && (c.fast || c.tenDays)],
    [/Avinu Malkenu/, c => c.avinuMalkeinu],
    [/Tachanun/, c => c.tachanun]
  ]);
}

function weekdayMaariv() {
  const parts = [{ special: 'chanukahCandles', when: c => c.chanukah > 0 }];
  parts.push(...many('Weekday, Maariv', [
    [/Motza'ei Shabbat/, c => c.motzeiShabbat],
    [/Sefirat HaOmer/, c => c.omer > 0],
    [/LeDavid/, c => c.elul],
    [/Birkat HaLevana/, c => c.h.d >= 3 && c.h.d <= 15, OPTIONAL],
    [/Keri'at Shema al Hamita/, every, OPTIONAL]
  ]));
  parts.push({ special: 'shiva', when: c => c.shiva });
  parts.push(sec('Shabbat, Havdalah', c => c.motzeiShabbat || c.motzeiYomTov));
  return parts;
}

function shabbatEve() {
  return [
    { special: 'chanukahCandles', when: c => c.chanukah > 0, note: 'On Friday, light Chanukah candles before the Shabbat candles.' },
    ...many('Shabbat, Kabbalat Shabbat', [
      [/Psalm (95|96|97|98|99|29)|Yedid|Ana Bekoach/, c => !c.cholHamoed && !c.prev.yomTov],
      [/Bameh Madlikin|Kaddish DeRabbanan/, c => !c.chanukah && !c.cholHamoed && !c.prev.yomTov, OPTIONAL]
    ]),
    { special: 'shivaFridayNight', when: c => c.shiva },
    ...many('Shabbat, Maariv', [
      [/Sefirat HaOmer/, c => c.omer > 0],
      [/LeDavid/, c => c.elul],
      [/Yigdal|Adon Olam/, every, OPTIONAL]
    ]),
    ...many('Shabbat, Shabbat Evening')
  ];
}

function shabbatShacharit() {
  return [
    ...many('Shabbat, Shacharit', [
      [/Akedah|Sovereignty|Korbanot|Adon Olam|Yigdal/, every, OPTIONAL],
      [/Psalm 130/, c => c.tenDays],
      [/Mi Sheberach/, c => c.minyan, OPTIONAL],
      [/Birkat Hachodesh/, c => c.mevarchim],
      [/Av HaRachamim/, c => !c.mevarchim && !c.noTachanunDayExceptShabbat],
      [/Amidah, Kaddish Shalem/, c => !c.hallel]
    ]),
    { special: 'hallel', when: c => c.hallel, after: 'Shabbat, Shacharit, Amidah, Concluding Passage' },
    ...many('Shabbat, Musaf LeShabbat', [
      [/For Shabbat Rosh Chodesh/, c => c.roshChodesh],
      [/Sanctity of the Day, For Shabbat$/, c => !c.roshChodesh],
      [/LeDavid/, c => c.elul],
      [/Shir HaKavod|Adon Olam/, every, OPTIONAL]
    ])
  ];
}

function shabbatMincha() {
  return many('Shabbat, Minchah', [
    [/Al Hanisim for Chanukkah/, c => c.chanukah > 0],
    [/Al Hanisim for Purim/, c => c.purim],
    [/Torah Reading/, c => c.minyan],
    [/Tzidkatkhah/, c => !c.noTachanunDayExceptShabbat],
    [/Barchi Nafshi/, c => c.winterHalf]
  ]);
}

function yomTovService(c) {
  const regalim = keysUnder('Festivals, Shalosh Regalim, Amida for Maariv');
  if (c.service === 'maariv') {
    return [
      ...many('Shabbat, Maariv, Barchu'), ...many('Shabbat, Maariv, Blessings of the Shema'),
      sec('Shabbat, Maariv, Veshamru'), sec('Shabbat, Maariv, Half Kaddish'),
      ...regalim.map(k => sec(k)),
      sec('Weekday, Maariv, Kaddish Shalem'),
      sec('Weekday, Maariv, Sefirat HaOmer', c => c.omer > 0),
      sec('Weekday, Maariv, Alenu'), sec("Weekday, Maariv, Mourner's Kaddish")
    ];
  }
  if (c.service === 'mincha') {
    return [sec('Weekday, Minchah, Ashrei'), ...regalim.map(k => sec(k)), sec('Weekday, Minchah, Post Amidah, Kaddish Shalem'),
      sec('Weekday, Minchah, Concluding Prayers, Alenu'), sec("Weekday, Minchah, Concluding Prayers, Mourner's Kaddish")];
  }
  return [
    ...many('Shabbat, Shacharit, Preparatory Prayers', [[/Akedah|Sovereignty|Korbanot|Adon Olam|Yigdal/, every, OPTIONAL]]),
    ...many('Shabbat, Shacharit, Pesukei Dezimra', [[/Psalm 130/, () => false]]),
    ...many('Shabbat, Shacharit, Blessings of the Shema'),
    ...regalim.map(k => sec(k)),
    { special: 'hallel', when: every },
    sec('Festivals, Sukkot, Blessing on Lulav', c => c.sukkot && !c.shabbat),
    ...many('Shabbat, Shacharit, Torah Reading', [[/Mi Sheberach/, every, OPTIONAL]]),
    sec('Shabbat, Shacharit, Ashrei'), sec('Shabbat, Shacharit, Returning Sefer to Aron'), sec('Shabbat, Shacharit, Half Kaddish'),
    ...keysUnder('Festivals, Shalosh Regalim, Mussaf').map(k => sec(k)),
    ...many('Shabbat, Musaf LeShabbat, Kaddish Shalem'), sec('Shabbat, Musaf LeShabbat, Ein Keloheinu'),
    sec('Shabbat, Musaf LeShabbat, Alenu'), sec("Shabbat, Musaf LeShabbat, Mourner's Kaddish")
  ];
}

function cholHamoedExtras(parts, c) {
  // Weekday services on Chol Hamoed / Rosh Chodesh get Musaf after Uva Letzion.
  if (c.service !== 'shacharit') return parts;
  const i = parts.findIndex(p => p.musafAfter);
  if (i < 0) return parts;
  const musaf = [];
  if (c.cholHamoed) musaf.push({ special: 'heading', title: 'Musaf for Chol Hamoed' }, ...keysUnder('Festivals, Shalosh Regalim, Mussaf').map(k => sec(k)));
  else if (c.roshChodesh) musaf.push({ special: 'heading', title: 'Musaf for Rosh Chodesh' }, ...keysUnder('Festivals, Rosh Chodesh, Musaf Amidah').map(k => sec(k)));
  if (c.sukkot && !c.shabbat) parts.splice(parts.findIndex(p => p.special === 'hallel') + 1, 0, sec('Festivals, Sukkot, Blessing on Lulav'));
  parts.splice(parts.findIndex(p => p.musafAfter) + 1, 0, ...musaf);
  return parts;
}

function buildService(c) {
  c.noTachanunDayExceptShabbat = (() => {
    const f = c;
    return f.yomTov || f.cholHamoed || f.roshChodesh || f.chanukah > 0 || f.h.m === 'Nisan' ||
      (f.h.m === 'Iyar' && (f.h.d === 14 || f.h.d === 18)) || (f.h.m === 'Sivan' && f.h.d <= 12) ||
      (f.h.m === 'Av' && f.h.d === 15) || (f.h.m === 'Tishrei' && f.h.d >= 9) || (f.h.m === 'Shevat' && f.h.d === 15) ||
      f.purim || f.shushanPurim || f.purimKatan;
  })();
  c.winterHalf = (c.h.m === 'Tishrei' && c.h.d >= 23) || ['Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar I', 'Adar II'].includes(c.h.m) || (c.h.m === 'Nisan' && c.h.d < 15);
  if (c.mode === 'highHoliday') return [{ special: 'highHoliday' }];
  if (c.mode === 'yomTov') return yomTovService(c);
  if (c.mode === 'shabbat') {
    if (c.service === 'maariv') return shabbatEve();
    if (c.service === 'mincha') return shabbatMincha();
    return shabbatShacharit();
  }
  if (c.service === 'mincha') return weekdayMincha();
  if (c.service === 'maariv') return weekdayMaariv();
  return cholHamoedExtras(weekdayShacharit(c), c);
}

// ---------- paragraph rules ----------
const normLabel = l => l.replace(/<[^>]+>/g, '').replace(/[”“״]/g, '"').replace(/[’׳]/g, "'").replace(/\s+/g, ' ').trim().replace(/[:\-–]\s*$/, '').trim();
const TEN = /^(בעשי"ת|בעש"ת|בש"ת|בעשרת ימי תשובה)/;
const LABEL_RULES = [
  [/^(בעשי"ת|בעש"ת|בש"ת) (מסיים|יסיים)$/, c => c.tenDays, 'Ten Days of Repentance', true],
  [/^(בעשי"ת|בעש"ת|בש"ת|בעשרת ימי תשובה)( מוסיפין)?$/, c => c.tenDays, 'Ten Days of Repentance'],
  [/^בקיץ$/, c => !c.winter && c.sayTal, 'Summer'],
  [/^בחורף/, c => c.winter, 'Winter'],
  [/^בימות החמה$/, c => !c.talUmatar, "V'ten bracha"],
  [/^בימות הגשמים$/, c => c.talUmatar, 'Tal umatar'],
  [/^בראש חדש ובחול המועד/, c => c.yaalehVeyavo, 'Rosh Chodesh & Chol Hamoed'],
  [/^בראש חודש מוסיפים$/, c => c.roshChodesh, 'Rosh Chodesh'],
  [/^בחנוכה$/, c => c.chanukah > 0, 'Chanukah'],
  [/^בפורים$/, c => c.purim, 'Purim'],
  [/^בתענית ציבור אומר כאן הש"ץ ברכת כהנים$/, c => c.fast && c.minyan, 'Fast day'],
  [/^בתענית ציבור/, c => c.fast, 'Fast day'],
  [/^במנחת תשעה באב$/, c => c.av9, "Tisha B'Av"],
  [/^נשים אומרות$/, c => c.female, 'Women say'],
  [/^לשבת$/, c => c.shabbat, 'Shabbat'],
  [/^לשלש רגלים$/, c => c.yomTov, 'Festival'],
  [/^בשבת$/, c => c.shabbat, 'Shabbat'],
  [/^ביו"ט כשחל בחול$/, c => c.yomTov && !c.shabbat, 'Festival on a weekday'],
  [/^בשבת ראש חודש/, c => c.shabbat && c.roshChodesh, 'Shabbat Rosh Chodesh'],
  [/^בשבת תשובה/, c => c.shabbat && c.tenDays, 'Shabbat Shuvah'],
  [/^מא' אלול עד אחר שמיני עצרת/, c => c.elul, 'Elul to Shemini Atzeret'],
  [/^בראש חודש ובחוה"מ פסח מדלגין$/, c => !c.halfHallel, 'Skipped in half Hallel'],
  [/^לפסח$/, c => c.pesach, 'Pesach'],
  [/^לשבועות$/, c => c.shavuot, 'Shavuot'],
  [/^(לסכות|סוכות)$/, c => c.sukkot, 'Sukkot'],
  [/^לשמ"ע ולש"ת$/, c => c.shminiAtzeret, 'Shemini Atzeret'],
  [/^לר"ח$/, c => c.roshChodesh, 'Rosh Chodesh']
];
const DOW_LABELS = ['בראשון בשבת', 'בשני בשבת', 'בשלישי בשבת', 'ברביעי בשבת', 'בחמישי בשבת', 'בשישי בשבת'];
const SPEAKER = /^(קהל|הקהל|חזן|החזן|שליח צ|ש"ץ|הש"ץ|אבל|קדיש יתום|הכהנים|העולה|יחיד|והקהל|ועונין|ואומר)/;
// Prayer text is fully vocalized; halachic notes are not (they may quote a few vocalized words).
function isVocalized(txt) {
  const letters = (txt.match(/[\u05D0-\u05EA]/g) || []).length;
  const marks = (txt.match(/[\u05B0-\u05BC\u05C1\u05C2\u05C7]/g) || []).length;
  return letters > 0 && marks / letters > 0.5;
}
const PLAIN_PREFIX = /^(לפסח|לשבועות|סוכות|לסכות|לשמ"ע ולש"ת)\s*-\s*/;

function findRule(label) { return LABEL_RULES.find(([re]) => re.test(label)); }

// Inline alternatives inside a paragraph.
function inlineProcess(html, c) {
  html = html.replace(/<em>\s*(<small>[\s\S]*?<\/small>)\s*<\/em>/g, '$1');
  // Ya'aleh V'yavo: keep only today's occasion.
  html = html.replace(/<small>\s*לר["״”]ח:?\s*<\/small>([\s\S]*?)<small>\s*לפסח:?\s*<\/small>([\s\S]*?)<small>\s*לסכות:?\s*<\/small>([\s\S]*?)(?=זָכְרֵ)/,
    (m, rc, pes, suk) => {
      const pick = c.roshChodesh ? rc : c.pesach ? pes : c.sukkot ? suk : null;
      return pick ? `<mark class="today">${pick.trim()}</mark> ` : m;
    });
  // "(בעשי"ת X)" style parentheticals.
  html = html.replace(/\(\s*<small>\s*(בעשי["״”]ת|בעש["״”]ת|בש["״”]ת)\s*<\/small>([^)]*)\)/g,
    (m, l, alt) => c.tenDays ? `<mark class="today" title="Ten Days of Repentance">(${alt.trim()})</mark>` : '');
  html = html.replace(/<small>([\s\S]*?)<\/small>/g, (m, inner) => {
    const n = normLabel(inner);
    let mm = n.match(/^(בעשי"ת|בעש"ת|בש"ת|בעשרת ימי תשובה)[:\s-]+(.+)$/);
    if (mm) return c.tenDays ? `<mark class="today" title="Ten Days of Repentance">${inner.replace(/^[^:\s-]+[:\s-]+/, '')}</mark>` : '';
    mm = n.match(/^לשבת[:\s-]+(.+)$/);
    if (mm) return c.shabbat ? `<mark class="today" title="Shabbat">${inner.replace(/^לשבת[:\s-]+/, '')}</mark>` : '';
    mm = n.match(/^בחורף[:\s-]+(.+)$/);
    if (mm) return c.winter ? `<mark class="today">${inner.replace(/^בחורף[:\s-]+/, '')}</mark>` : '';
    if (/^גרסת הגר"א/.test(n)) return '';
    if (SPEAKER.test(n) && n.length < 30) return `<span class="who">${n}</span>`;
    return `<small class="hint">${inner}</small>`;
  });
  return html;
}

// Returns rendered paragraphs for a section, with hidden alternatives removed.
function processSection(sec, c) {
  const out = [];
  let applyNext = null; // { show, tag } from a label-only paragraph
  let dowBlock = null; // index of weekday in a Song of the Day block
  const paras = sec.he;
  const isAvinu = /Avinu Malkenu/.test(sec.k);
  const isOmer = /Sefirat HaOmer/.test(sec.k);

  for (let i = 0; i < paras.length; i++) {
    let p = paras[i];
    let show = true, tag = null, kind = 'text', replacesPrev = false;

    // Leading label: "<small>LABEL</small> rest" or "(<small>LABEL</small> rest)".
    const m = p.match(/^\(?\s*(?:<em>)?\s*<small>([^<]{1,90})<\/small>\s*(?:<\/em>)?\s*(?:<br\s*\/?>)?\s*/);
    const label = m ? normLabel(m[1]) : null;
    const rest = m ? p.slice(m[0].length).replace(/\)\s*$/, m[0].startsWith('(') ? '' : ')') : p;
    const restText = rest.replace(/<[^>]+>/g, '').trim();

    if (label && DOW_LABELS.includes(label)) { dowBlock = DOW_LABELS.indexOf(label); continue; }

    if (label && !restText && isVocalized(label)) { out.push({ kind: 'optional', html: inlineProcess(m[1], c), show: true }); continue; }
    if (isOmer && label && /^\s*\d+\.\s/.test(restText)) p = rest;

    if (label && !restText) {
      // Label on its own line: applies to the next paragraph.
      const r = findRule(label);
      if (r) { applyNext = { show: r[1](c), tag: r[2], replacesPrev: !!r[3] }; continue; }
      if (SPEAKER.test(label) && label.length < 30) { out.push({ kind: 'who', html: label }); continue; }
      if (/:\s*$/.test(m[1]) || label.length <= 20) { out.push({ kind: 'label', html: m[1] }); continue; }
      out.push({ kind: 'note', html: m[1] }); continue;
    }

    if (label && restText && p !== rest) {
      const r = findRule(label);
      if (r) { show = r[1](c); tag = r[2]; replacesPrev = !!r[3]; p = rest; }
      else if (SPEAKER.test(label) && label.length < 30) { p = `<span class="who">${label}</span> ${rest}`; }
    }

    // Whole-paragraph small text: halachic note (no vowels) or optional prayer (with vowels).
    const fullSmall = /^\s*<small>[\s\S]*<\/small>\s*$/.test(p) && !/<\/small>[\s\S]*\S[\s\S]*<small>/.test(p.replace(/^\s*<small>/, '').replace(/<\/small>\s*$/, ''));
    if (!label && fullSmall) {
      const txt = p.replace(/<[^>]+>/g, '');
      kind = isVocalized(txt) ? 'optional' : 'note';
    }

    const pm = normLabel(p.slice(0, 30)).match(PLAIN_PREFIX);
    if (pm) { const r = findRule(normLabel(pm[1])); if (r) { show = r[1](c); tag = r[2]; p = p.replace(PLAIN_PREFIX, ''); } }

    if (applyNext) { show = applyNext.show; tag = applyNext.tag; replacesPrev = applyNext.replacesPrev; applyNext = null; }
    if (dowBlock !== null && dowBlock !== c.dow) show = false;

    // Content rules where the source has no usable label.
    const text = p.replace(/<[^>]+>/g, '');
    if (/שֶׁלֹּא עָשַֽׂנִי אִשָּׁה|שֶׁלֹּא עָשַׂנִי אִשָּׁה/.test(text) && c.female) show = false;
    if (/^\s*(<b>)?עַל הַנִּסִּים/.test(p.replace(/<\/?b>/g, '')) && !(c.chanukah > 0 || c.purim)) show = false;
    if (/^\s*(<b>)?עַל הַנִּסִּים/.test(p.replace(/<\/?b>/g, '')) && (c.chanukah > 0 || c.purim)) tag = c.purim ? 'Purim' : 'Chanukah';
    if (isAvinu && /כָּתְבֵֽנוּ בְּסֵֽפֶר/.test(text)) { show = c.tenDays; tag = 'Ten Days of Repentance'; }
    if (isAvinu && /<b>אָבִֽינוּ מַלְכֵּֽנוּ זָכְרֵֽנוּ לְ|<b>אָבִֽינוּ מַלְכֵּֽנוּ זָכְרֵֽנוּ לִ/.test(p)) { show = c.fast; tag = 'Fast day'; }
    if (isOmer) {
      const n = text.match(/^\s*(\d+)\.\s/);
      if (n) { show = Number(n[1]) === c.omer; if (show) tag = `Tonight: day ${c.omer}`; p = p.replace(/(\s*)\d+\.\s/, '$1'); }
    }

    if (replacesPrev && show) {
      for (let j = out.length - 1; j >= 0; j--) if (out[j].kind === 'text' && out[j].show !== false) { out[j].show = false; break; }
    }
    out.push({ kind, html: inlineProcess(p, c), show, tag });
  }
  return out;
}

// ---------- kaddish & minyan-only sections ----------
const KADDISH_MOURNER = /Mourner's Kaddish|Kaddish De?Rabbanan|Kaddish Derabbanan/;
const KADDISH_CHAZZAN = /Half Kaddish|Kaddish Shalem/;
const NEEDS_MINYAN = /Barchu$|Kedushah|Keduasha|Birkat Kohanim|Torah Reading|Returning Sefer/;

const TRANSLIT = {
  mourner: [
    "Yitgadal v'yitkadash sh'mei raba. (Amen)",
    "B'alma di v'ra chirutei, v'yamlich malchutei b'chayeichon uv'yomeichon uv'chayei d'chol beit Yisrael, ba'agala uvizman kariv, v'imru amen. (Amen)",
    "Y'hei sh'mei raba m'varach l'alam ul'almei almaya.",
    "Yitbarach v'yishtabach v'yitpa'ar v'yitromam v'yitnasei v'yit'hadar v'yit'aleh v'yit'halal sh'mei d'kudsha, b'rich hu. (B'rich hu)",
    "L'eila min kol birchata v'shirata, tushb'chata v'nechemata, da'amiran b'alma, v'imru amen. (Amen)",
    "Y'hei sh'lama raba min sh'maya, v'chayim aleinu v'al kol Yisrael, v'imru amen. (Amen)",
    "Oseh shalom bimromav, hu ya'aseh shalom aleinu v'al kol Yisrael, v'imru amen. (Amen)"
  ],
  rabbanan: [
    "Al Yisrael v'al rabanan, v'al talmideihon v'al kol talmidei talmideihon, v'al kol man d'askin b'oraita, di v'atra hadein v'di v'chol atar v'atar,",
    "y'hei l'hon ul'chon sh'lama raba, china v'chisda v'rachamin, v'chayin arichin, um'zonei r'vichei, ufurkana, min kodam avuhon di vishmaya v'ara, v'imru amen. (Amen)",
    "Oseh shalom bimromav, hu b'rachamav ya'aseh shalom aleinu v'al kol Yisrael, v'imru amen. (Amen)"
  ]
};

// ---------- rendering ----------
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const titleOf = k => k.split(', ').slice(-1)[0];
const groupOf = k => {
  const parts = k.split(', ').slice(0, -1);
  if (/^(Weekday|Shabbat|Festivals)$/.test(parts[0])) parts.shift();
  if (/^(Shacharit|Minchah|Maariv)$/.test(parts[0]) && parts.length > 1) parts.shift();
  return parts.join(' · ');
};

function renderParas(items) {
  return items.filter(x => x.show !== false).map(x => {
    if (x.kind === 'who') return `<p class="who-line"><span class="who">${x.html}</span></p>`;
    if (x.kind === 'label') return `<p class="label-line">${x.html}</p>`;
    if (x.kind === 'note') return settings.notes ? `<p class="note">${x.html}</p>` : '';
    const cls = x.kind === 'optional' ? 'optional' : '';
    const tag = x.tag ? `<span class="tag">${esc(x.tag)}</span>` : '';
    return `<p class="${cls}${x.tag ? ' insert' : ''}">${tag}${x.html}</p>`;
  }).join('');
}

function englishBlock(sec) {
  if (!settings.english || !sec.en.length) return '';
  const paras = sec.en.filter(p => p.replace(/<[^>]+>/g, '').trim()).map(p => `<p>${p}</p>`).join('');
  return `<div class="en" lang="en">${paras}</div>`;
}

function sectionCard(sec, c, opts = {}) {
  const items = processSection(sec, c);
  const body = renderParas(items);
  if (!body.trim()) return '';
  const isMournerK = KADDISH_MOURNER.test(sec.k);
  const isChazzanK = KADDISH_CHAZZAN.test(sec.k) && !/Kaddish, /.test(sec.k);
  const needsMinyan = isMournerK || isChazzanK || NEEDS_MINYAN.test(sec.k);
  const id = 's-' + sec.k.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  let badge = '', open = !opts.optional, extraClass = '', note = opts.note || '';

  if (needsMinyan && !c.minyan) { open = false; note = 'Said only with a minyan (10 adults).'; extraClass = ' muted'; }
  if (isMournerK) {
    extraClass += ' kaddish';
    if (c.mourner && c.minyan) { badge = '<span class="badge you">You say this</span>'; open = true; }
    else if (!c.mourner) { open = false; badge = '<span class="badge">Said by mourners</span>'; }
  }
  if (opts.optional) badge += '<span class="badge">Optional</span>';

  let translit = '';
  if (isMournerK && settings.translit) {
    const t = /Rabbanan|Derabbanan/i.test(sec.k) ? TRANSLIT.rabbanan : TRANSLIT.mourner;
    translit = `<div class="translit" lang="en">${t.map(x => `<p>${esc(x)}</p>`).join('')}</div>`;
  }
  return `<details class="sec${extraClass}" id="${id}" ${open ? 'open' : ''}>
    <summary><span class="sec-title">${esc(opts.title || titleOf(sec.k))}</span>${badge}</summary>
    ${note ? `<p class="sec-note">${esc(note)}</p>` : ''}
    <div class="he" lang="he" dir="rtl">${body}</div>${translit}${englishBlock(sec)}
  </details>`;
}

function specialCard(item, c) {
  if (item.special === 'heading') return `<h2 class="group">${esc(item.title)}</h2>`;
  if (item.special === 'hallel') {
    const keys = keysUnder('Festivals, Rosh Chodesh, Hallel');
    const head = `<h2 class="group">${c.halfHallel ? 'Half Hallel' : 'Full Hallel'}</h2>`;
    const shivaNote = c.shiva ? 'In a shiva house the mourner does not say Hallel; others may say it in another room.' : '';
    return head + keys.map((k, i) => sectionCard(BY_KEY[k], c, { note: i === 0 ? shivaNote : '' })).join('');
  }
  if (item.special === 'chanukahCandles') {
    const keys = keysUnder('Festivals, Chanukah');
    const n = c.chanukah;
    const intro = `Tonight is night ${n} of Chanukah: light ${n} candle${n > 1 ? 's' : ''} plus the shamash.` + (n === 1 ? ' Say Shehecheyanu (the third blessing) tonight only.' : ' Skip Shehecheyanu (the third blessing); it is said on the first night only.');
    return `<h2 class="group">Chanukah candles</h2>` + keys.map((k, i) => sectionCard(BY_KEY[k], c, { note: i === 0 ? (item.note ? item.note + ' ' : '') + intro : '' })).join('');
  }
  if (item.special === 'shiva') {
    const p = c.noTachanunDay ? 16 : 49;
    const ps = SIDDUR_DATA.psalms[p];
    const he = ps.he.map(x => `<p>${x}</p>`).join('');
    const en = settings.english ? `<div class="en" lang="en">${ps.en.map(x => `<p>${x}</p>`).join('')}</div>` : '';
    return `<details class="sec kaddish" open><summary><span class="sec-title">Psalm ${p} in the house of mourning</span><span class="badge you">Shiva</span></summary>
      <p class="sec-note">${p === 49 ? 'Said after the service in a shiva house, followed by Mourner\'s Kaddish.' : 'On days without Tachanun, Psalm 16 replaces Psalm 49.'}</p>
      <div class="he" lang="he" dir="rtl">${he}</div>${en}</details>` +
      sectionCard(BY_KEY["Kaddish, Mourner's Kaddish"], c, { title: "Mourner's Kaddish after the psalm" });
  }
  if (item.special === 'shivaFridayNight') {
    return `<div class="callout">In shiva: mourners wait outside the sanctuary until after Lecha Dodi. When they enter, the congregation greets them: <span lang="he" dir="rtl" class="he-inline">הַמָּקוֹם יְנַחֵם אֶתְכֶם בְּתוֹךְ שְׁאָר אֲבֵלֵי צִיּוֹן וִירוּשָׁלָיִם</span>.</div>`;
  }
  if (item.special === 'highHoliday') {
    return `<div class="callout big">Today is ${c.roshHashana ? 'Rosh Hashanah' : 'Yom Kippur'}. The services are long and unique to the day, so use a machzor. Kaddish and Aleinu are below.</div>` +
      sectionCard(BY_KEY['Weekday, Shacharit, Concluding Prayers, Alenu'], c) + sectionCard(BY_KEY["Kaddish, Mourner's Kaddish"], c);
  }
  return '';
}

const SERVICE_NAMES = { shacharit: 'Shacharit', mincha: 'Mincha', maariv: 'Maariv' };
function serviceTitle(c) {
  if (c.mode === 'shabbat' && c.service === 'maariv') return 'Kabbalat Shabbat & Maariv';
  if (c.mode === 'shabbat' && c.service === 'shacharit') return 'Shabbat Shacharit & Musaf';
  if (c.mode === 'shabbat' && c.service === 'mincha') return 'Shabbat Mincha';
  if (c.mode === 'yomTov') return 'Festival ' + SERVICE_NAMES[c.service] + (c.service === 'shacharit' ? ' & Musaf' : '');
  if (c.service === 'maariv' && (c.motzeiShabbat || c.motzeiYomTov)) return 'Maariv & Havdalah';
  return SERVICE_NAMES[c.service];
}

function todayNotes(c) {
  const n = [];
  const amidah = c.mode === 'weekday' || c.mode === 'shabbat' || c.mode === 'yomTov';
  if (amidah) {
    n.push(c.winter ? 'Mashiv haruach' : (c.sayTal ? 'Morid hatal' : 'No rain phrase (summer)'));
    if (c.mode === 'weekday') n.push(c.talUmatar ? "V'ten tal umatar" : "V'ten bracha");
  }
  if (c.yaalehVeyavo) n.push("Ya'aleh v'yavo");
  if (c.chanukah || c.purim) n.push('Al Hanissim');
  if (c.tenDays) n.push('Ten Days inserts');
  if (c.fast && c.service === 'mincha') n.push('Aneinu');
  if (c.hallel && c.service === 'shacharit') n.push(c.halfHallel ? 'Half Hallel' : 'Full Hallel');
  if (c.mode === 'weekday' && c.service !== 'maariv') n.push(c.tachanun ? 'Tachanun' : 'No Tachanun');
  if (c.torahReading && c.service === 'shacharit') n.push('Torah reading');
  if (c.omer && c.service === 'maariv') n.push(`Count Omer: day ${c.omer}`);
  if (c.elul) n.push("L'David (Ps. 27)");
  if (c.avinuMalkeinu && c.mode === 'weekday' && c.service !== 'maariv') n.push('Avinu Malkeinu');
  if (c.motzeiShabbat) n.push('Atah chonantanu + Havdalah');
  return n;
}

function render() {
  const c = context();
  const items = buildService(c);
  document.documentElement.style.setProperty('--he-size', settings.size + 'rem');

  // Day header
  const labels = dayLabels(c);
  const civilStr = c.civil.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  document.getElementById('heb-date').textContent = hebrewDateHe(c.h);
  document.getElementById('civil-date').textContent = civilStr + (c.ctxDate.getTime() !== c.civil.getTime() ? ' · evening (Hebrew date has begun)' : '');
  document.getElementById('day-chips').innerHTML = labels.map(l => `<span class="chip occasion">${esc(l)}</span>`).join('') +
    (settings.mourner ? '<span class="chip mourn">Saying Kaddish</span>' : '') + (settings.shiva ? '<span class="chip mourn">Shiva house</span>' : '');
  document.getElementById('today-notes').innerHTML = todayNotes(c).map(x => `<li>${esc(x)}</li>`).join('');
  document.getElementById('service-title').textContent = serviceTitle(c);
  document.querySelectorAll('[data-service]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.service === c.service)));
  document.getElementById('date-input').value = isoDate(c.civil);

  // Service body
  let html = '', lastGroup = '';
  for (const item of items) {
    if (item.when && !item.when(c)) continue;
    if (item.special) { html += specialCard(item, c); lastGroup = ''; continue; }
    const s = BY_KEY[item.k];
    if (!s) continue;
    const g = groupOf(item.k);
    if (g !== lastGroup) { html += `<h2 class="group">${esc(g)}</h2>`; lastGroup = g; }
    const note = item.noteFn ? item.noteFn(c) : '';
    html += sectionCard(s, c, { optional: item.optional, note });
  }
  document.getElementById('service').innerHTML = html;
  buildToc();
  renderMourner(c);
}

function buildToc() {
  const heads = [...document.querySelectorAll('#service h2.group')];
  const toc = document.getElementById('toc');
  toc.innerHTML = heads.map((h, i) => { h.id = 'g' + i; return `<button type="button" data-jump="g${i}">${esc(h.textContent.split(' · ').pop())}</button>`; }).join('');
}

// ---------- mourner's corner ----------
function elMalei(name, parent, female) {
  const g = (m, f) => female ? f : m;
  const who = name ? `${name} ${g('בֶּן', 'בַּת')} ${parent || '…'}` : `[${g('פלוני בן פלוני', 'פלונית בת פלוני')}]`;
  return `אֵל מָלֵא רַחֲמִים, שׁוֹכֵן בַּמְּרוֹמִים, הַמְצֵא מְנוּחָה נְכוֹנָה עַל כַּנְפֵי הַשְּׁכִינָה, בְּמַעֲלוֹת קְדוֹשִׁים וּטְהוֹרִים כְּזֹהַר הָרָקִיעַ מַזְהִירִים, אֶת נִשְׁמַת <mark class="today">${esc(who)}</mark> ${g('שֶׁהָלַךְ לְעוֹלָמוֹ', 'שֶׁהָלְכָה לְעוֹלָמָהּ')}, בַּעֲבוּר שֶׁבְּלִי נֶדֶר אֶתֵּן צְדָקָה בְּעַד הַזְכָּרַת ${g('נִשְׁמָתוֹ', 'נִשְׁמָתָהּ')}. בְּגַן עֵדֶן תְּהֵא ${g('מְנוּחָתוֹ', 'מְנוּחָתָהּ')}. לָכֵן בַּעַל הָרַחֲמִים ${g('יַסְתִּירֵהוּ', 'יַסְתִּירֶהָ')} בְּסֵתֶר כְּנָפָיו לְעוֹלָמִים, וְיִצְרוֹר בִּצְרוֹר הַחַיִּים אֶת ${g('נִשְׁמָתוֹ', 'נִשְׁמָתָהּ')}, יְהֹוָה הוּא ${g('נַחֲלָתוֹ', 'נַחֲלָתָהּ')}, ${g('וְיָנוּחַ', 'וְתָנוּחַ')} בְּשָׁלוֹם עַל ${g('מִשְׁכָּבוֹ', 'מִשְׁכָּבָהּ')}, וְנֹאמַר אָמֵן.`;
}

// Next yahrzeit: same Hebrew day and month as the passing, on or after today.
function nextYahrzeit(passing, afterSunset) {
  const death = hdate(afterSunset ? addDays(passing, 1) : passing);
  const today = todayCivil();
  for (let k = 0; k < 420; k++) {
    const dt = addDays(today, k);
    const h = hdate(dt);
    let m = death.m;
    const leap = isLeapYear(h.y);
    if (m === 'Adar' && leap) m = 'Adar I';                 // Ashkenazi custom: Adar I in a leap year
    if ((m === 'Adar I' || m === 'Adar II') && !leap) m = 'Adar';
    let d = death.d;
    if (h.m === m && h.d === d) return { dt, death };
    // Day 30 in a 29-day month: observe on the 1st of the next month (customs differ).
    if (d === 30 && h.d === 1 && hdate(addDays(dt, -1)).m === m && hdate(addDays(dt, -1)).d === 29) return { dt, death, shifted: true };
  }
  return null;
}

function renderMourner(c) {
  const name = document.getElementById('em-name').value.trim();
  const parent = document.getElementById('em-parent').value.trim();
  const fem = document.getElementById('em-female').checked;
  document.getElementById('el-malei').innerHTML = elMalei(name, parent, fem);
  const dIn = document.getElementById('yz-date').value;
  const out = document.getElementById('yz-out');
  if (!dIn) { out.textContent = 'Enter the date of passing to find the next yahrzeit.'; return; }
  const r = nextYahrzeit(fromIso(dIn), document.getElementById('yz-sunset').checked);
  if (!r) { out.textContent = 'Could not find the next yahrzeit date.'; return; }
  const eve = addDays(r.dt, -1);
  const fmt = d => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const isToday = r.dt.getTime() === todayCivil().getTime();
  out.innerHTML = `Hebrew date of passing: <b>${esc(hebrewDateHe(r.death))}</b> (${r.death.d} ${esc(r.death.m)}).<br>` +
    (isToday ? '<b>The yahrzeit is today.</b> ' : '') +
    `Next yahrzeit: <b>${esc(fmt(r.dt))}</b>, starting the evening of ${esc(fmt(eve))}. Light the candle that evening.` +
    (r.shifted ? '<br>The 30th of that month does not occur this year, so this shows the 1st of the next month. Ask your rabbi, since customs differ.' : '');
}

// ---------- tabs ----------
const TAB_TITLES = { pray: 'Siddur', mourners: 'Mourners', settings: 'Settings' };
function showTab(tab) {
  for (const t of Object.keys(TAB_TITLES)) {
    document.getElementById('view-' + t).hidden = t !== tab;
    const btn = document.querySelector(`[data-tab="${t}"]`);
    if (t === tab) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
  }
  document.getElementById('seg').hidden = tab !== 'pray';
  document.getElementById('bar-title').textContent = TAB_TITLES[tab];
  onTabChange(tab);
  document.body.classList.toggle('grouped', tab !== 'pray');
  window.scrollTo({ top: 0 });
}

// ---------- events ----------
function bind() {
  document.querySelectorAll('[data-service]').forEach(b => b.addEventListener('click', () => { state.service = b.dataset.service; render(); window.scrollTo({ top: 0 }); }));
  document.getElementById('date-input').addEventListener('change', e => { state.date = e.target.value ? fromIso(e.target.value) : null; render(); });
  document.getElementById('today-btn').addEventListener('click', () => { state.date = null; state.service = null; render(); });
  for (const key of ['mourner', 'minyan', 'shiva', 'israel', 'female', 'sayTal', 'english', 'notes', 'translit']) {
    const el = document.getElementById('opt-' + key);
    el.checked = !!settings[key];
    el.addEventListener('change', () => {
      settings[key] = el.checked;
      if (key === 'israel') { settings.sayTal = el.checked; document.getElementById('opt-sayTal').checked = el.checked; }
      if (key === 'shiva' && el.checked) { settings.mourner = true; document.getElementById('opt-mourner').checked = true; }
      saveSettings(); render();
    });
  }
  document.getElementById('toc').addEventListener('click', e => {
    const id = e.target.closest('[data-jump]')?.dataset.jump;
    if (id) document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  const mourn = ['em-name', 'em-parent', 'em-female', 'yz-date', 'yz-sunset'];
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('siddur.mourner') || '{}'); } catch (e) { saved = {}; }
  for (const id of mourn) {
    const el = document.getElementById(id);
    if (saved[id] !== undefined) { if (el.type === 'checkbox') el.checked = saved[id]; else el.value = saved[id]; }
    el.addEventListener('input', () => {
      const v = {};
      for (const i of mourn) { const x = document.getElementById(i); v[i] = x.type === 'checkbox' ? x.checked : x.value; }
      try { localStorage.setItem('siddur.mourner', JSON.stringify(v)); } catch (e) { /* storage blocked */ }
      renderMourner(context());
    });
  }
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) { /* not available */ }
}

bind();
bindTheme();
bindReader();
bindTilt();
bindUpdates();
render();
