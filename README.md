# Siddur

A Nusach Ashkenaz siddur that sets itself for the day. Pick Shacharit, Mincha or Maariv and it shows the right service for today's Hebrew date, with every seasonal and holiday insert switched on or off automatically.

## What it handles

- **The calendar**: Rosh Chodesh, Chanukah, Purim (including leap years), fast days with their postponements, Chol Hamoed, festivals, the Ten Days of Repentance, Elul, and the Omer count. Maariv uses the coming Hebrew day.
- **Inserts**: mashiv haruach / morid hatal, v'ten tal umatar (Israel and abroad), Ya'aleh V'yavo, Al Hanissim, Aneinu, the Ten Days changes, Atah Chonantanu.
- **Order of service**: Tachanun (and when to skip it), Hallel (full or half), Torah reading days, Musaf on Rosh Chodesh and Chol Hamoed, the Song of the Day, L'David, Avinu Malkeinu, Birkat HaChodesh, Havdalah, Chanukah candles, Shabbat and festival services.
- **Mourners**: "I'm saying Kaddish" opens every Mourner's Kaddish with transliteration; "Shiva house" drops Tachanun and adds Psalm 49 (or 16) with Kaddish; El Malei Rachamim with the name filled in; the comforting phrase; a yahrzeit date finder.
- **Settings**: minyan or alone, in Israel, women's wording, English translation, halachic notes, text size.

## Build

```
node tools/fetch-sefaria.js   # optional: re-download the source text into data/
node tools/build-data.js      # trims it to src/data.json
node tools/build.js           # writes siddur.html and dist/index.html
```

`dist/index.html` is a standalone page that works offline.

## Sources

Text from Sefaria: the Metsudah Siddur (1981) and the translation based on the Metsudah linear siddur by Avrohom Davis, both CC-BY. Psalms 16 and 49 from Miqra according to the Masorah (CC-BY-SA) with the JPS 1917 translation (public domain).
