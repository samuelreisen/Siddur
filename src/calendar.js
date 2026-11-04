// Hebrew calendar facts for a given day, built on the browser's built-in Hebrew calendar (Intl).
// Every date here is a UTC-noon Date so time zones never shift the day.

const DAY_MS = 864e5;
const HEB_FMT = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const MONTH_KEY = {
  Tishri: 'Tishrei', Tishrei: 'Tishrei', Heshvan: 'Cheshvan', Cheshvan: 'Cheshvan', Kislev: 'Kislev',
  Tevet: 'Tevet', Shevat: 'Shevat', 'Adar I': 'Adar I', 'Adar II': 'Adar II', Adar: 'Adar',
  Nisan: 'Nisan', Iyar: 'Iyar', Sivan: 'Sivan', Tamuz: 'Tammuz', Tammuz: 'Tammuz', Av: 'Av', Elul: 'Elul'
};
const MONTH_HE = {
  Tishrei: 'תִּשְׁרֵי', Cheshvan: 'חֶשְׁוָן', Kislev: 'כִּסְלֵו', Tevet: 'טֵבֵת', Shevat: 'שְׁבָט', Adar: 'אֲדָר',
  'Adar I': 'אֲדָר א׳', 'Adar II': 'אֲדָר ב׳', Nisan: 'נִיסָן', Iyar: 'אִיָּר', Sivan: 'סִיוָן', Tammuz: 'תַּמּוּז', Av: 'אָב', Elul: 'אֱלוּל'
};

function utcNoon(y, m, d) { return new Date(Date.UTC(y, m, d, 12)); }
function addDays(dt, n) { return new Date(dt.getTime() + n * DAY_MS); }
function isoDate(dt) { return dt.toISOString().slice(0, 10); }
function fromIso(s) { const [y, m, d] = s.split('-').map(Number); return utcNoon(y, m - 1, d); }
function isLeapYear(y) { return ((7 * y + 1) % 19) < 7; }

function hdate(dt) {
  const p = {};
  for (const x of HEB_FMT.formatToParts(dt)) p[x.type] = x.value;
  return {
    d: Number(p.day),
    m: MONTH_KEY[p.month] || p.month,
    y: parseInt(String(p.year || p.relatedYear).replace(/\D/g, ''), 10),
    dow: dt.getUTCDay()
  };
}

// Hebrew numerals: 5787 -> תשפ״ז, 24 -> כ״ד
function gematria(n) {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  n = n % 1000;
  let s = hundreds[Math.floor(n / 100)];
  const rest = n % 100;
  if (rest === 15) s += 'טו';
  else if (rest === 16) s += 'טז';
  else s += tens[Math.floor(rest / 10)] + ones[rest % 10];
  return s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
}

function hebrewDateHe(h) { return `${gematria(h.d)} ${MONTH_HE[h.m] || h.m} ${gematria(h.y)}`; }

// Finds how many days ago (0..max) the given Hebrew month/day fell, or -1.
function daysSince(dt, month, day, max) {
  for (let k = 0; k <= max; k++) {
    const x = hdate(addDays(dt, -k));
    if (x.m === month && x.d === day) return k;
  }
  return -1;
}

// Diaspora rule for starting "v'ten tal umatar": evening of Dec 4 (Dec 5 before a Gregorian leap year).
function talUmatarDiaspora(dt, h) {
  const month = dt.getUTCMonth();
  const y = dt.getUTCFullYear();
  if (month === 11) {
    const next = y + 1;
    const nextLeap = (next % 4 === 0 && next % 100 !== 0) || next % 400 === 0;
    // Maariv is said with the next day's date, so the day being entered must be Dec 5 (or 6).
    return dt.getUTCDate() >= (nextLeap ? 6 : 5);
  }
  if (month <= 4) return !((h.m === 'Nisan' && h.d >= 15) || h.m === 'Iyar' || h.m === 'Sivan');
  return false;
}

// All the facts the siddur needs about one Hebrew day. `israel` changes festival length and rain prayers.
function dayFacts(dt, israel) {
  const h = hdate(dt);
  const leap = isLeapYear(h.y);
  const purimMonth = leap ? 'Adar II' : 'Adar';
  const is = (m, d) => h.m === m && h.d === d;
  const between = (m, a, b) => h.m === m && h.d >= a && h.d <= b;
  const c = { h, leap, dow: h.dow, israel };

  c.shabbat = h.dow === 6;
  c.roshHashana = between('Tishrei', 1, 2);
  c.yomKippur = is('Tishrei', 10);
  c.roshChodesh = h.d === 30 || (h.d === 1 && h.m !== 'Tishrei');
  c.tenDays = between('Tishrei', 1, 10);
  c.elul = h.m === 'Elul' || between('Tishrei', 1, 21);

  c.sukkot = between('Tishrei', 15, 21);
  c.shminiAtzeret = is('Tishrei', 22) || (!israel && is('Tishrei', 23));
  c.pesach = between('Nisan', 15, israel ? 21 : 22);
  c.shavuot = is('Sivan', 6) || (!israel && is('Sivan', 7));
  c.yomTov = c.roshHashana || c.yomKippur || c.shminiAtzeret ||
    is('Tishrei', 15) || (!israel && is('Tishrei', 16)) ||
    is('Nisan', 15) || (!israel && is('Nisan', 16)) ||
    is('Nisan', 21) || (!israel && is('Nisan', 22)) || c.shavuot;
  c.cholHamoedSukkot = c.sukkot && !c.yomTov;
  c.cholHamoedPesach = c.pesach && !c.yomTov;
  c.cholHamoed = c.cholHamoedSukkot || c.cholHamoedPesach;
  c.hoshanaRabba = is('Tishrei', 21);

  const chan = daysSince(dt, 'Kislev', 25, 7);
  c.chanukah = chan >= 0 ? chan + 1 : 0;
  c.purim = h.m === purimMonth && h.d === 14;
  c.shushanPurim = h.m === purimMonth && h.d === 15;
  c.purimKatan = leap && h.m === 'Adar I' && (h.d === 14 || h.d === 15);

  // Fasts, with the standard postponements when the date falls on Shabbat.
  c.av9 = (is('Av', 9) && h.dow !== 6) || (is('Av', 10) && h.dow === 0);
  c.fast = c.av9 ||
    (is('Tishrei', 3) && h.dow !== 6) || (is('Tishrei', 4) && h.dow === 0) ||
    is('Tevet', 10) ||
    (h.m === purimMonth && h.d === 13 && h.dow !== 6) || (h.m === purimMonth && h.d === 11 && h.dow === 4) ||
    (is('Tammuz', 17) && h.dow !== 6) || (is('Tammuz', 18) && h.dow === 0);

  const om = (h.m === 'Nisan' || h.m === 'Iyar' || h.m === 'Sivan') ? daysSince(dt, 'Nisan', 15, 49) : -1;
  c.omer = om >= 1 ? om : 0;

  // Rain season: "mashiv haruach" from Shemini Atzeret to Pesach.
  c.winter = (h.m === 'Tishrei' && h.d >= 22) ||
    ['Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar I', 'Adar II'].includes(h.m) ||
    (h.m === 'Nisan' && h.d < 15);
  c.talUmatar = israel
    ? ((h.m === 'Cheshvan' && h.d >= 7) || ['Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar I', 'Adar II'].includes(h.m) || (h.m === 'Nisan' && h.d < 15))
    : talUmatarDiaspora(dt, h);

  c.yaalehVeyavo = c.roshChodesh || c.cholHamoed;
  c.hallel = (c.roshChodesh && h.m !== 'Tishrei') || c.chanukah > 0 || c.cholHamoed || (c.yomTov && !c.roshHashana && !c.yomKippur);
  c.halfHallel = (c.roshChodesh && c.chanukah === 0) || c.cholHamoedPesach || (c.pesach && h.d > (israel ? 15 : 16));

  // Days with no Tachanun (Ashkenaz custom).
  c.noTachanunDay = c.shabbat || c.yomTov || c.cholHamoed || c.roshChodesh || c.chanukah > 0 ||
    h.m === 'Nisan' || is('Iyar', 14) || is('Iyar', 18) || between('Sivan', 1, 12) ||
    c.av9 || is('Av', 15) || is('Elul', 29) || (h.m === 'Tishrei' && (h.d <= 2 || h.d >= 9)) ||
    is('Shevat', 15) || c.purim || c.shushanPurim || c.purimKatan;

  c.torahReading = !c.shabbat && !c.yomTov && (h.dow === 1 || h.dow === 4 || c.roshChodesh || c.chanukah > 0 || c.fast || c.purim || c.cholHamoed);
  return c;
}

function dayLabels(c) {
  const out = [];
  if (c.roshHashana) out.push('Rosh Hashanah');
  if (c.yomKippur) out.push('Yom Kippur');
  if (c.tenDays && !c.roshHashana && !c.yomKippur) out.push('Ten Days of Repentance');
  if (c.pesach) out.push(c.cholHamoedPesach ? 'Chol Hamoed Pesach' : 'Pesach');
  if (c.sukkot) out.push(c.hoshanaRabba ? 'Hoshana Rabba' : c.cholHamoedSukkot ? 'Chol Hamoed Sukkot' : 'Sukkot');
  if (c.shminiAtzeret) out.push(c.israel || c.h.d === 22 ? 'Shemini Atzeret' : 'Simchat Torah');
  if (c.shavuot) out.push('Shavuot');
  if (c.roshChodesh) out.push('Rosh Chodesh');
  if (c.chanukah) out.push(`Chanukah, day ${c.chanukah}`);
  if (c.purim) out.push('Purim');
  if (c.shushanPurim) out.push('Shushan Purim');
  if (c.purimKatan) out.push('Purim Katan');
  if (c.av9) out.push("Tisha B'Av");
  else if (c.fast) out.push('Fast day');
  if (c.omer) out.push(`Omer, day ${c.omer}`);
  if (c.shabbat) out.push('Shabbat');
  return out;
}
