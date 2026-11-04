<!-- handoff-mark: 1 -->

**Current mark: Mk I**

# Siddur – handoff

> **MAINTENANCE RULE.** EVERYTHING done to this project is saved in this file. Every session reads this file first, in full.
> After each change (code, config, docs, files, a fix, an experiment, a refactor, even a small one), add a dated entry at the top of the
> Change log (section 14), newest first, with exactly these four fields:
> - **Asked** – the owner's request, quoted or closely paraphrased.
> - **Changed** – what was changed, with root causes and file names.
> - **Verified** – how it was checked, with real numbers, tests run and counts. Never just "works".
> - **Not done** – honest limits, and what was skipped, such as untested parts or no commit/push.
>
> The same step must also correct any other section the change makes untrue. This document is kept correct, not just appended to.
> A prompt that changes nothing (a pure question) needs no entry. Never remove or edit the `handoff-mark` stamp on line 1 by hand:
> `scripts/make-mark.js` owns it.

## 1. What it is and who it is for
A Nusach Ashkenaz siddur (Jewish prayer book) that sets itself for the day. The person picks Shacharit, Mincha or Maariv and gets the right service for today's Hebrew date, with every seasonal and holiday insert switched on or off automatically. It has options for mourners: Mourner's Kaddish opened with transliteration, a shiva-house mode, El Malei Rachamim with the name filled in, and a yahrzeit date finder.

It ships two ways:
- A single-file web page, published as a private claude.ai artifact: https://claude.ai/artifact/S7iPr9hUaxgDFg6H87YVkF (built from `siddur.html`).
- An offline Android app (Kotlin WebView wrapper) on the `android-app` branch, with a prebuilt `apk/siddur-debug.apk`.

**Owner:** Samuel Reisen (GitHub `samuelreisen`), repo `samuelreisen/Siddur`.

**What the owner cares about / their standards** (observed in the first session, owner to confirm): wants things fast ("asap"); uses the phone, so phone-width layout and offline use matter; wants an Apple HIG look and feel; wants complete work, no placeholders; asked that the text come from a real published siddur, not be typed from memory; likes delegating mechanical work to sub-agents (tiered-delegation skill). Writing style for replies: casual, swearing is fine, never use em dashes.

## 2. How to run it
Requires Node 18+ (uses global `fetch`). No npm dependencies.

```
node tools/fetch-sefaria.js   # optional: re-download the source text into data/ (needs internet)
node tools/build-data.js      # trims data/ to src/data.json (about 1.5 MB)
node tools/build.js           # writes siddur.html (artifact body) and dist/index.html (standalone page)
```

Open `dist/index.html` in any browser to use it. To publish the artifact, publish `siddur.html` to the URL above with the Artifact tool (same file path in the same session, or pass the URL from another session).

Android (on the `android-app` branch):
```
node tools/android-assets.js  # copies dist/index.html into android/app/src/main/assets/, swapping Google Fonts for the bundled font
cd android && ./gradlew assembleDebug   # needs JDK 17+ and ANDROID_HOME
```

> **DANGER: test data.** Tests and experiments must run against a scratch data folder, never the real data.
> Real data lives at: each user's own browser or Android WebView `localStorage`, keys `siddur.settings` and `siddur.mourner` (the mourner key holds a deceased person's name and date of passing). Nothing is stored in the repo or on a server.
> There is no env var. Test with Playwright's fresh, throwaway browser context (it starts with empty storage), as the session-1 tests did. Never script anything that clears storage on a real device.
> If this project has no scratch switch yet, point it at a temporary copy before running anything that writes.

## 3. Repository map
- `src/index.html`: page shell (top bar with service switch, Pray / Mourners / Settings views, bottom tab bar). Has `/*CSS*/`, `/*DATA*/`, `/*JS*/` placeholders that `tools/build.js` fills.
- `src/app.css`: all styles. HIG-style tokens, light, dark and increased-contrast modes.
- `src/calendar.js`: Hebrew calendar facts for a day (`dayFacts`), Hebrew numerals, labels. Pure functions, built on `Intl` with the Hebrew calendar.
- `src/app.js`: settings, which service to build, the label rules that show or hide inserts, rendering, mourner tools, tabs.
- `src/data.json`: generated, trimmed text (406 sections plus Psalms 16 and 49). Do not hand-edit; regenerate with `tools/build-data.js`.
- `data/raw-siddur-ashkenaz.json`: full Sefaria download (449 of 456 sections). `data/order.txt`: section order. `data/raw-psalm-16.json`, `data/raw-psalm-49.json`.
- `tools/fetch-sefaria.js`, `tools/build-data.js`, `tools/build.js`: the pipeline above.
- `siddur.html`: built artifact body (no doctype; the claude.ai host wraps it). `dist/index.html`: built standalone page.
- `scripts/`: the update-file ("mark") system: `markpack.js`, `make-mark.js`, `install-mark.js`, `verify-mark-system.js`, `mark.config.json`.
- `marks/history.json`: every mark made. `marks/out/`: the `.oleh` files.
- `CLAUDE.md`: tells Claude to read this file first.
- On `android-app` only: `android/` (Gradle project), `tools/android-assets.js`, `.github/workflows/android.yml`, `apk/siddur-debug.apk`, `android/app/src/main/assets/fonts/` (Frank Ruhl Libre woff2 subsets plus OFL.txt).

## 4. Data model
`src/data.json` is `{ sections: [{ k, he: [paragraph html], en: [paragraph html] }], psalms: { 16: { he, en }, 49: { he, en } } }`.
- `k` is the Sefaria section path without the "Siddur Ashkenaz, " prefix, for example `Weekday, Shacharit, Amidah, Divine Might`. Services are assembled by key prefix.
- Paragraphs are Sefaria HTML: `<b>` for opening words, `<small>` for instructions and labels, sometimes `<em><small>` (Kaddish, festival Amidah).
- 163 sections have no English. Shabbat sections borrow the weekday English when the paragraph counts match.

Settings (`localStorage['siddur.settings']`): `mourner, minyan, shiva, israel, female, sayTal, english, notes, translit, size`. Israel and sayTal default to on when the time zone is Asia/Jerusalem or Tel_Aviv.

## 5. Core logic
1. **Which day.** `context()` in `app.js`: Maariv uses tomorrow's date (the Hebrew day has begun), except between midnight and 4am with no date override. Everything else uses today.
2. **Day facts.** `dayFacts(date, israel)` in `calendar.js`: Rosh Chodesh, festivals (Israel vs diaspora lengths), Chol Hamoed, Chanukah day (counted back to 25 Kislev), Purim in Adar or Adar II, fasts with Shabbat postponements, Omer day, winter (mashiv haruach), tal umatar (Israel from 7 Cheshvan; abroad from the Maariv entering Dec 5, or Dec 6 before a Gregorian leap year), Hallel full or half, no-Tachanun days (Ashkenaz), Torah reading days.
3. **Which service.** `buildService(c)`: `highHoliday` (Rosh Hashanah, Yom Kippur: points to a machzor), `yomTov`, `shabbat` (Friday night Kabbalat Shabbat, Shabbat Shacharit plus Musaf, Shabbat Mincha), or `weekday`. Weekday Shacharit on Rosh Chodesh or Chol Hamoed gets Hallel after the Amidah and Musaf after Uva Letzion. Each section has a `when(c)` rule.
4. **Which inserts.** `processSection()`: a paragraph that starts with a `<small>` label is matched against `LABEL_RULES` (for example `בעשי"ת` means the Ten Days, `בחורף` winter, `בימות הגשמים` tal umatar). A label on its own line applies to the next paragraph. Labels ending in `מסיים` / `יסיים` replace the previous paragraph. Song of the Day uses weekday "block" labels. Inline smalls are handled by `inlineProcess()`, including picking the right occasion inside Ya'aleh V'yavo. Content rules cover what has no label (women's blessing, Al Hanissim opener, Avinu Malkeinu blocks, the Omer count number).
5. **Notes vs prayer.** A fully-small paragraph is a halachic note if under half its letters carry vowel marks (`isVocalized`); notes are hidden unless "Halachic Notes" is on.
6. **Minyan and mourners.** Kaddish, Barchu, Kedushah, Birkat Kohanim and Torah reading collapse without a minyan. Mourner's Kaddish and Kaddish D'Rabbanan open with transliteration when "Saying Kaddish" is on. Shiva house adds Psalm 49 (16 on no-Tachanun days) plus Kaddish and turns off Tachanun.

Regression targets (numbers this logic was verified against, re-check after changing it). Diaspora unless noted:
- 2026-11-04: 24 Cheshvan 5787, Tachanun, v'ten bracha, mashiv haruach. Same date in Israel: tal umatar.
- 2026-12-04: no tal umatar. 2026-12-05: Chanukah day 1 and Shabbat, tal umatar on.
- 2026-12-11: 1 Tevet, Rosh Chodesh plus Chanukah day 7: full Hallel, Ya'aleh V'yavo shows "רֹאשׁ הַחֹדֶשׁ הַזֶּה", Al Hanissim (Chanukah paragraph), Torah reading, no Tachanun.
- 2026-12-20: 10 Tevet fast. Mincha: Aneinu, Avinu Malkeinu, Tachanun.
- 2027-03-22: 13 Adar II fast (Ta'anit Esther). 2027-03-23: Purim, Al Hanissim Purim paragraph.
- 2027-04-22: 15 Nisan, Pesach, festival service, full Hallel. 2027-04-25: Chol Hamoed Pesach, Omer day 3, half Hallel.
- 2027-05-24 Maariv (date 2027-05-25, 18 Iyar): Omer day 33, only that count shown.
- 2026-09-14: Tzom Gedaliah plus Ten Days. 2026-09-16 Shacharit: "HaMelech HaKadosh" replaces "HaEl HaKadosh", Avinu Malkeinu, L'David.
- 2026-11-06 Maariv: Kabbalat Shabbat with Lecha Dodi. 2026-11-07 Maariv: Havdalah and Atah Chonantanu.
- Wednesday Shacharit shows only Psalm 94 in the Song of the Day.
- 0 halachic notes visible with notes off; 41 visible with notes on (2026-11-04 Shacharit).

## 6. Subsystem notes
- **Mourner tools** (`renderMourner`, `elMalei`, `nextYahrzeit`): El Malei Rachamim text is written in the code (not from Sefaria), with male and female forms. Yahrzeit: Adar in a non-leap year maps to Adar I in a leap year (Ashkenazi custom); a 30th that doesn't exist that year shows the 1st of the next month, with a note that customs differ.
- **Chanukah candles**: shown at the top of weekday Maariv and Friday-night services during Chanukah, with the night number and the Shehecheyanu rule.
- **Kaddish transliteration**: written in `TRANSLIT` in `app.js` (Mourner's and D'Rabbanan).

## 7. Traps and facts only real data revealed
- Sefaria's section order is not the API return order. Always use `data/order.txt`.
- Source labels use mixed quote characters (`"`, `”`, `״`). `normLabel` normalizes them.
- Source text contains meteg and other marks (`ֽ`), so a plain Hebrew string search often misses. Search by tags or by structure in tests.
- The "Summer" / "Winter" labels for v'ten bracha and tal umatar are `בימות החמה` / `בימות הגשמים`, separate from `בקיץ` / `בחורף` (mashiv haruach).
- Psalms from Sefaria carry cantillation and `&thinsp;<small>׀</small>&thinsp;`; `build-data.js` strips them in that order (the pattern must be replaced before the paseq character is removed).
- The JPS Gender-Sensitive translation on Sefaria is CC-BY-NC, so the psalms use JPS 1917 (public domain) instead.
- The Write tool turned `ְ`-style escapes into literal characters in one file. Prefer explicit escapes via a script when a regex needs Hebrew ranges.
- 7 of 456 Sefaria sections failed to download (Weekday Minchah Vidui, Shabbat Mizmor Letoda, Shabbat Shacharit Amidah Holiness of God, a Bat Mitzvah blessing, and others). None are needed today.
- `android-actions/setup-android@v3`'s default package list includes the legacy `tools` package, which the runner's newer sdkmanager lacks; the workflow lists packages explicitly.

## 8. Persistence
Only browser/WebView `localStorage`: `siddur.settings` and `siddur.mourner`. Every read and write is wrapped in try/catch, and the page works without storage. Nothing is synced or backed up.

**Must never be lost:** the source text pipeline (`data/`, `tools/`), and the owner's artifact URL. Users' mourner details live only on their device.

## 9. UI notes and traps
- Apple HIG design (session 1): bottom tab bar (Pray, Mourners, Settings), large title, prayers edge to edge with hairline separators, settings as grouped lists with switches (`input[role="switch"]`), 17px body text, 44px targets, accent blue only for controls, gold for today's inserts, purple for mourner items, true-black dark mode, `prefers-contrast: more`.
- Hebrew is set in Frank Ruhl Libre via Google Fonts on the web; Android bundles the font (the app has no internet permission).
- Hebrew text is right-aligned on phones and justified at 600px and wider (justify left big gaps on narrow screens).
- Artifact pages can't use reserved hashes (`settings` and others), so tabs are in-page state, not URL routes.
- Wake lock is requested and may be refused; Android keeps the screen on via `FLAG_KEEP_SCREEN_ON`.

## 10. Platform and build notes
- Android: package `com.samuelreisen.siddur`, min API 24, target and compile 35, AGP 8.7.3, Kotlin 2.0.21, Gradle wrapper 8.14.3, versionName 1.0 (`shellVersion` 1.0.0 in `scripts/mark.config.json`). Debug-signed only.
- CI: `.github/workflows/android.yml` on `android-app` builds the page, then the APK, and uploads `siddur-debug-apk`.
- In the session-1 cloud container the SDK was at `/home/user/android-sdk` and Java 21 worked; Maven Central sometimes returned HTTP 429 through the proxy, and a re-run fixed it.
- The Android app has no updater of its own, so marks install with `scripts/install-mark.js` into a checkout, not into the app.

## 11. Working method
- Read this file first. Log every change (see the Maintenance rule).
- Ship changes with `node scripts/make-mark.js --title "..." --notes "..." --entry entry.md`. Call `node` directly for multi-line notes: on Windows, `npm run` cuts a multi-line argument at the first line break.
- Marks are named Mk I, Mk II, Mk III (roman numerals). The `handoff-mark` stamp and `marks/history.json` hold the plain number. Update files use the extension `.oleh` (magic bytes `OLEH____`).
- Install a mark with `node scripts/install-mark.js <file>` (newer HANDOFF.md wins, the replaced one is kept in `handoff-history/`). `node scripts/verify-mark-system.js` re-checks the whole system.
- Branches: `main` holds the web app and this file; `android-app` holds main plus the Android project. Merge `main` into `android-app` after changes, then rerun `tools/android-assets.js` and rebuild the APK. PR #1 (`android-app` into `main`) is a draft.
- After changing the page, rebuild (`tools/build.js`) and republish `siddur.html` to the artifact URL.
- Git commits use the owner's name and email; commits and PRs carry Claude attribution lines.

## 12. Open items and known quirks (prioritised)
1. The Android APK has not been run on a physical device.
2. The CI build for `android-app` failed twice on the setup-android `tools` package; the fix (commit c3cca0c) was pushed and its run had not reported at the time of writing.
3. Not yet supported: Rosh Hashanah and Yom Kippur services (points to a machzor), Selichot, Hoshanot, Yizkor, Birkat HaMazon, Kiddush for festivals, Sefardi or Chabad nusach.
4. Customs not modeled: Yom HaAtzmaut and Yom Yerushalayim (Tachanun, Hallel), Shushan Purim in Jerusalem, a chatan or brit in the minyan (no Tachanun), Tachanun on Erev Rosh Hashanah at Selichot.
5. Festival-day services reuse Shabbat Shacharit parts; Shabbat and festival Kedushah wording comes straight from the source sections.
6. Hebrew-only UI labels in the source text (instructions) are shown in Hebrew.

## 13. Rough chronology (why the code looks the way it does)
- Session 1 (2026-11-04): asked for a siddur "asap" as an artifact plus an Android app with smart pages and mourner options. First plan was to type the texts; the owner said to find a siddur online, so the whole Metsudah siddur was pulled from Sefaria, and the day logic was built on its own instruction labels instead of hand-written texts. The Android shell was delegated to a Sonnet sub-agent and reviewed. The UI was then redesigned to the Apple HIG. Then this handoff system was added.

## 14. Change log
Format: `### <date> – <title>` then the four fields **Asked**, **Changed**, **Verified**, **Not done**. Newest first. Mark entries read `### <date> – Mk <Roman> "<title>" – update file` and end with a **Mark file** line.

### 2026-11-04 – Verified the mark system
- **Asked** – Part of setting up handoff and update files (step 9 of the skill).
- **Changed** – Nothing in the code. Committed `marks/history.json` and `marks/out/Siddur-MkI.oleh` so the file is in the repo.
- **Verified** – `node scripts/verify-mark-system.js`: 21/21 checks passed. Roman names (Mk I, II, IV, IX, XIV, XL), Mk I parses with the install parser (1,849,958 bytes, sha256 matches history), HANDOFF.md inside with stamp 1, file named `Siddur-MkI.oleh`; in a scratch copy a temporary Mk II replaced Mk I with backups `HANDOFF-MkI-…-was-none.md` and `HANDOFF-MkII-…-was-MkI.md`; installing Mk I over Mk II was refused with no extra backup; tampered (DAMAGED), wrong magic (NOT_A_MARK) and too-new shell (TOO_NEW) files were refused and changed nothing; the real `marks/history.json` was untouched.
- **Not done** – No install into the Android app (it has no updater). Owner standards in section 1 still need confirming.

### 2026-11-04 – Mk I "Smart siddur, first mark" – update file
- **Asked** – Set up handoff and update files with extension `.oleh`, and ship the first mark of the project as it stands.
- **Changed** – First mark of the Siddur: the smart Ashkenaz siddur web app (Sefaria Metsudah text, day-aware service and insert logic, mourner tools, Apple HIG design), its build pipeline and data, the built `siddur.html` and `dist/index.html`, this HANDOFF.md, CLAUDE.md and the mark scripts. Built from `main`, so it does not contain the `android/` project; marks built from `android-app` will.
- **Verified** – Dry run self-check passed before writing (the file is parsed back with the installer's parser, HANDOFF.md inside matches, stamp equals 1). `node scripts/verify-mark-system.js` is run right after; its result is recorded in the next change-log entry.
- **Not done** – No Android code in Mk I. The Android app has no updater, so marks are installed into a checkout with `scripts/install-mark.js`, not into the app.
- **Mark file:** `marks/out/Siddur-MkI.oleh` (24 files, minimum shell 1.0.0)

### 2026-11-04 – Set up HANDOFF.md and the update-file system
- **Asked** – Run the handoff-and-updates skill: living HANDOFF.md plus numbered update files with extension `.oleh`.
- **Changed** – Added `HANDOFF.md` (this file), `CLAUDE.md` with the read-this-first block, `scripts/markpack.js`, `scripts/make-mark.js`, `scripts/install-mark.js`, `scripts/verify-mark-system.js` (copied from the skill templates unchanged), `scripts/mark.config.json` (project Siddur, ext `.oleh`, shellVersion 1.0.0 from the Android versionName, ships source, data, built pages, scripts, and on `android-app` also `android/` and `.github/`; excludes build output and `*.apk`), and `marks/history.json` (`[]`). No app wiring: the Android app has no updater.
- **Verified** – See the Mk I entry and the "Verified the mark system" entry above (21/21 checks).
- **Not done** – Mk I is built by the next step of setup. Owner standards in section 1 are inferred from session 1 and need the owner's confirmation.

### 2026-11-04 – Fix Android CI
- **Asked** – Automatic: CI failure on PR #1.
- **Changed** – `.github/workflows/android.yml` on `android-app`: `setup-android` now gets `packages: 'platform-tools platforms;android-35 build-tools;35.0.0'`. Root cause: its default list includes the legacy `tools` package, which the runner's sdkmanager 16.0 no longer provides, so the job exited before building.
- **Verified** – Both failed runs' logs show `Failed to find package 'tools'`. The same three packages are what the local APK build uses. YAML parses.
- **Not done** – The new CI run had not reported when this was written.

### 2026-11-04 – Apple HIG redesign
- **Asked** – Use the apple-hig-design skill on the siddur.
- **Changed** – Rewrote `src/index.html` and `src/app.css`; added tab switching in `src/app.js`. Audit findings fixed: prayers were below setup panels, every prayer was a card, 16px body, 10.5px tags, accent used on non-interactive chips, checkboxes instead of switches, 36px chips, no pressed states, mixed capitalisation. Android: dark system bars `#161618`, window `#000000`, dark nav icons in light mode (`values-v27`, `values-night-v27`).
- **Verified** – Logic tests unchanged (Omer day 33, Purim and Chanukah Al Hanissim, 0/41 notes); screenshots at 390px in light and dark for Pray, Settings, Mourners; page width 390 (no sideways scroll); 0 script errors; offline Android page: font loaded, 11 switches, 0 errors. Artifact republished (version 2).
- **Not done** – Not tested on a physical phone.

### 2026-11-04 – Android app
- **Asked** – "In a different branch an android loadable app."
- **Changed** – Branch `android-app`: Kotlin WebView app in `android/` loading the bundled page, Frank Ruhl Libre bundled, `tools/android-assets.js`, CI workflow, prebuilt `apk/siddur-debug.apk`. Draft PR #1.
- **Verified** – `./gradlew assembleDebug` succeeded; `aapt2 dump badging` showed package `com.samuelreisen.siddur`; the page loaded with all network blocked, the font rendered, 0 errors.
- **Not done** – Not run on a device or emulator.

### 2026-11-04 – Smart siddur web app
- **Asked** – "Make me a siddur asap as an artifact" with "smart pages based on the day with options for mourners etc", then "Try find a siddur online for the text."
- **Changed** – Built the Sefaria pipeline (`tools/`), calendar (`src/calendar.js`), label-driven insert engine and services (`src/app.js`), page and styles, published the artifact.
- **Verified** – Calendar checked on 18 dates (section 5 targets); headless-browser runs over 14 date and service cases with 0 script errors; specific inserts checked paragraph by paragraph.
- **Not done** – Customs listed in section 12 are not modeled.
