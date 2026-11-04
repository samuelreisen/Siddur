<!-- handoff-mark: 2 -->

**Current mark: Mk II**

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
> Real data lives at: each user's own browser or Android WebView `localStorage`, keys `siddur.settings` and `siddur.mourner` (the mourner key holds a deceased person's name and date of passing). Nothing is stored in the repo or on a server. The Android app also keeps installed updates in its own files folder (`site/MkN/`, `updates/files/`, `updates/state.json`).
> There is no env var. Test with Playwright's fresh, throwaway browser context (it starts with empty storage), as the session-1 tests did. Never script anything that clears storage on a real device.
> If this project has no scratch switch yet, point it at a temporary copy before running anything that writes.

## 3. Repository map
- `src/index.html`: page shell (top bar with service switch, Pray / Mourners / Settings views, bottom tab bar). Has `/*CSS*/`, `/*DATA*/`, `/*JS*/` placeholders that `tools/build.js` fills.
- `src/app.css`: all styles. HIG-style tokens, light, dark and increased-contrast modes.
- `src/calendar.js`: Hebrew calendar facts for a day (`dayFacts`), Hebrew numerals, labels. Pure functions, built on `Intl` with the Hebrew calendar.
- `src/app.js`: settings, which service to build, the label rules that show or hide inserts, rendering, mourner tools, tabs.
- `src/tilt.js`: tilt to turn pages (motion sensor flick detection, page scroll, toast). Built before `app.js` in the same script, so it shares `settings`.
- `src/updates.js`: the App Updates section in Settings. Shown only when the Android app provides `window.SiddurApp`.
- `src/data.json`: generated, trimmed text (406 sections plus Psalms 16 and 49). Do not hand-edit; regenerate with `tools/build-data.js`.
- `data/raw-siddur-ashkenaz.json`: full Sefaria download (449 of 456 sections). `data/order.txt`: section order. `data/raw-psalm-16.json`, `data/raw-psalm-49.json`.
- `tools/fetch-sefaria.js`, `tools/build-data.js`, `tools/build.js`: the pipeline above.
- `siddur.html`: built artifact body (no doctype; the claude.ai host wraps it). `dist/index.html`: built standalone page.
- `scripts/`: the update-file ("mark") system: `markpack.js`, `make-mark.js`, `install-mark.js`, `verify-mark-system.js`, `mark.config.json`.
- `marks/history.json`: every mark made. `marks/out/`: the `.oleh` files.
- `CLAUDE.md`: tells Claude to read this file first.
- On `android-app` only: `android/` (Gradle project), `tools/android-assets.js`, `.github/workflows/android.yml`, `apk/siddur-debug.apk`, `android/app/src/main/assets/fonts/` (Frank Ruhl Libre woff2 subsets plus OFL.txt).
  - `android/app/src/main/java/com/samuelreisen/siddur/`: `MainActivity.kt` (WebView, asset loader, file picker, opening `.oleh` files), `MarkFile.kt` (reads `.oleh`, same checks as `markpack.js`), `Updater.kt` (installed versions, which page to show, keeps 5), `UpdateBridge.kt` (`window.SiddurApp`, GitHub downloads).
  - `android/app/src/test/.../MarkUpdateTest.kt`: unit tests (`./gradlew testDebugUnitTest`), reading the real `marks/out/Siddur-MkI.oleh`.
  - `android/app/src/main/assets/bundled-mark.json`: which Mk the built-in page is, written by `tools/android-assets.js` from `mark.json`.
  - `android/app/proguard-rules.pro`: keeps the bridge methods in release builds.

## 4. Data model
`src/data.json` is `{ sections: [{ k, he: [paragraph html], en: [paragraph html] }], psalms: { 16: { he, en }, 49: { he, en } } }`.
- `k` is the Sefaria section path without the "Siddur Ashkenaz, " prefix, for example `Weekday, Shacharit, Amidah, Divine Might`. Services are assembled by key prefix.
- Paragraphs are Sefaria HTML: `<b>` for opening words, `<small>` for instructions and labels, sometimes `<em><small>` (Kaddish, festival Amidah).
- 163 sections have no English. Shabbat sections borrow the weekday English when the paragraph counts match.

Settings (`localStorage['siddur.settings']`): `mourner, minyan, shiva, israel, female, sayTal, english, notes, translit, size, tilt, tiltStrength` (`tiltStrength` is `firm`, `hard` or `veryhard`). Israel and sayTal default to on when the time zone is Asia/Jerusalem or Tel_Aviv.

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
- **Tilt to turn pages** (`src/tilt.js`, Settings › Display, off by default): reads `devicemotion` rotation speed. A flick to the left (negative value) scrolls forward one screen minus the top bar, section bar and 48px overlap; a flick to the right scrolls back. It turns only when the speed passes the threshold (Firm 200, Hard 300 default, Very Hard 420 degrees per second) for 2 readings in a row, then ignores all motion for 1000 ms so the swing back doesn't undo the turn. Ignored while a finger is on the screen, on the Mourners and Settings tabs, and when the page is hidden. Counts a twist (rotation about the screen's vertical axis: `gamma` in portrait, `beta` in landscape) or a steer (`alpha`, counterclockwise is left), whichever is stronger. Shows a "Next page" / "Previous page" toast and a 12 ms vibration. If no readings arrive within 2.5 s it says sensors aren't available. On iOS it asks permission on the tap; only an explicit "denied" turns it off (Chromium answers "prompt" without asking).
- **In-app updates** (Android 1.1.0+, Settings › App Updates, only on tap): Check for Updates downloads `https://raw.githubusercontent.com/samuelreisen/Siddur/main/marks/history.json`; if its newest mark is newer than the one in use it offers it ("needs a newer app" when its `minShell` is above the app's version). Install downloads the `.oleh` named in the history record (path must match `marks/out/*.oleh`), checks its sha256 against the record, parses it with `MarkFile` (magic, header, payload and per-file checksums, safe paths, minShell), writes `site/MkN/index.html` with the Google Fonts link pointed at `/assets/fonts/fonts.css`, stores the file, keeps the newest 5 and reloads. Install Update File… and opening a `.oleh` from Files install the chosen file and pin it. The page in use is the installed mark when it is newer than the built-in one or was picked by hand; otherwise the built-in page, so a newer APK moves past an older download. Pages load from `https://appassets.androidplatform.net` (`/assets/` and `/site/`) through `WebViewAssetLoader`, one origin, so `localStorage` survives version switches. raw.githubusercontent.com caches for about 5 minutes, so a just-pushed mark can take that long to show.

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
Browser/WebView `localStorage`: `siddur.settings` and `siddur.mourner`. Every read and write is wrapped in try/catch, and the page works without storage. Nothing is synced or backed up (the Android app sets `allowBackup="false"`, since the mourner data names the deceased). The Android app also keeps installed updates in its files folder (see section 6). App 1.1.0 moved the page from `file:///android_asset/` to `https://appassets.androidplatform.net`, a new origin, so settings saved in app 1.0 don't carry over (once).

**Must never be lost:** the source text pipeline (`data/`, `tools/`), and the owner's artifact URL. Users' mourner details live only on their device.

## 9. UI notes and traps
- Apple HIG design (session 1): bottom tab bar (Pray, Mourners, Settings), large title, prayers edge to edge with hairline separators, settings as grouped lists with switches (`input[role="switch"]`), 17px body text, 44px targets, accent blue only for controls, gold for today's inserts, purple for mourner items, true-black dark mode, `prefers-contrast: more`.
- Hebrew is set in Frank Ruhl Libre via Google Fonts on the web; Android bundles the font and points every page at it, so it works offline (the app's internet permission is only used for updates).
- Hebrew text is right-aligned on phones and justified at 600px and wider (justify left big gaps on narrow screens).
- Artifact pages can't use reserved hashes (`settings` and others), so tabs are in-page state, not URL routes.
- Wake lock is requested and may be refused; Android keeps the screen on via `FLAG_KEEP_SCREEN_ON`.
- The claude.ai artifact viewer blocks motion sensors (no motion capability exists for this account), so tilt never works on the artifact; it shows the "sensors aren't available" note there.
- `[hidden] { display: none !important; }` is in `app.css` because the standalone page (Android) has no host reset and some hidden rows use `display: flex`.

## 10. Platform and build notes
- Android: package `com.samuelreisen.siddur`, min API 24, target and compile 35, AGP 8.7.3, Kotlin 2.0.21, Gradle wrapper 8.14.3, versionCode 2, versionName 1.1.0 (the "shell" version update files are checked against; `shellVersion` 1.1.0 in `scripts/mark.config.json`, `minShell` 1.0.0). Libraries: appcompat, activity-ktx, webkit (`WebViewAssetLoader`); tests use junit and the real org.json. The shipped APK is debug-signed; the release build type is minified and shrunk but has no release keystore yet. Manifest: `allowBackup="false"`, `usesCleartextTraffic="false"`, `INTERNET`, `launchMode="singleTask"`, a VIEW filter for `application/octet-stream` content (opening `.oleh` files; anything else is refused with a message).
- CI: `.github/workflows/android.yml` on `android-app` builds the page, then the APK, and uploads `siddur-debug-apk`.
- In the session-1 cloud container the SDK was at `/home/user/android-sdk` and Java 21 worked; Maven Central sometimes returned HTTP 429 through the proxy, and a re-run fixed it.
- The Android app installs marks itself (section 6). `scripts/install-mark.js` still installs a mark into a checkout. The app reads only `dist/index.html`, `mark.json` and `HANDOFF.md` from a mark; it never writes other paths from the file.
- No emulator in the session-1 container (no KVM), so the native update flow was checked by unit tests and a live download check, not on a device.

## 11. Working method
- Read this file first. Log every change (see the Maintenance rule).
- Ship changes with `node scripts/make-mark.js --title "..." --notes "..." --entry entry.md`. Call `node` directly for multi-line notes: on Windows, `npm run` cuts a multi-line argument at the first line break.
- Marks are named Mk I, Mk II, Mk III (roman numerals). The `handoff-mark` stamp and `marks/history.json` hold the plain number. Update files use the extension `.oleh` (magic bytes `OLEH____`).
- Install a mark with `node scripts/install-mark.js <file>` (newer HANDOFF.md wins, the replaced one is kept in `handoff-history/`). `node scripts/verify-mark-system.js` re-checks the whole system.
- Branches: `main` holds the web app and this file; `android-app` holds main plus the Android project. The owner wants exactly these two branches and does not want PR #1 (`android-app` into `main`, draft) merged. Merge `main` into `android-app` after changes, then rerun `tools/android-assets.js` and rebuild the APK.
- Shipping an update to phones: on `main`, make the next mark and push (the app reads `marks/history.json` and `marks/out/` from `main`). Then merge into `android-app`, run `tools/android-assets.js` (it stamps `bundled-mark.json` from the new `mark.json`) and rebuild the APK, so the built-in page and its Mk number match. Bump the app's `versionName` and the mark config's `minShell` only when a page needs something new from the app.
- After changing the page, rebuild (`tools/build.js`) and republish `siddur.html` to the artifact URL.
- Git commits use the owner's name and email; commits and PRs carry Claude attribution lines.

## 12. Open items and known quirks (prioritised)
1. The Android APK has not been run on a physical device. The in-app update flow (bridge, download, reload, file picker, opening a `.oleh`) is untested on a device.
2. Update files are checked for damage (sha256), not signed. Anyone who can push to `main`, or who gets someone to open a crafted `.oleh`, can replace the page, and that page could read the saved mourner details and send them out now that the app has internet access. Fix: sign marks with a private key kept out of the repo and check the signature in `MarkFile`.
3. The APK is debug-signed with the build machine's key, which changes between sessions, so installing a newer APK over an older one can fail with "App not installed"; uninstall first. A release keystore kept outside the repo would fix it.
4. Phones on app 1.0 have no updater; they need the 1.1.0 APK installed by hand once, and lose their 1.0 settings (new page origin).
5. Tilt to turn pages was tested only with simulated sensor readings. On a real phone, check the direction (left must be forward), the landscape axis signs, and that "Hard" feels right; adjust `TILT_THRESHOLDS` or the signs in `tiltRate()` if not.
6. CI builds the APK on GitHub (fixed setup-android packages). The artifact upload may fail while the account artifact quota is full; it no longer fails the job.
7. Not yet supported: Rosh Hashanah and Yom Kippur services (points to a machzor), Selichot, Hoshanot, Yizkor, Birkat HaMazon, Kiddush for festivals, Sefardi or Chabad nusach.
8. Customs not modeled: Yom HaAtzmaut and Yom Yerushalayim (Tachanun, Hallel), Shushan Purim in Jerusalem, a chatan or brit in the minyan (no Tachanun), Tachanun on Erev Rosh Hashanah at Selichot.
9. Festival-day services reuse Shabbat Shacharit parts; Shabbat and festival Kedushah wording comes straight from the source sections.
10. Hebrew-only UI labels in the source text (instructions) are shown in Hebrew.

## 13. Rough chronology (why the code looks the way it does)
- Session 1 (2026-11-04): asked for a siddur "asap" as an artifact plus an Android app with smart pages and mourner options. First plan was to type the texts; the owner said to find a siddur online, so the whole Metsudah siddur was pulled from Sefaria, and the day logic was built on its own instruction labels instead of hand-written texts. The Android shell was delegated to a Sonnet sub-agent and reviewed. The UI was then redesigned to the Apple HIG. Then this handoff system was added.

## 14. Change log
Format: `### <date> – <title>` then the four fields **Asked**, **Changed**, **Verified**, **Not done**. Newest first. Mark entries read `### <date> – Mk <Roman> "<title>" – update file` and end with a **Mark file** line.

### 2026-11-04 – Fix verify-mark-system.js for projects past Mk I
- **Asked** – Part of shipping Mk II: the mark check dropped to 18/21 after Mk II was made.
- **Changed** – `scripts/verify-mark-system.js`: three checks compared the temporary test mark to the literal number 2. Since it is always the next mark after the real ones (Mk III now), they now compare to its real number, and the labels name it.
- **Verified** – `node scripts/verify-mark-system.js`: 21/21 (it was 18/21; the failure details already showed correct behaviour, "MkIII is newer than MkI"). Live check of the app path against GitHub: history lists Mk I and Mk II, Mk II downloads (1,867,740 bytes), its sha256 matches the record, it parses with shell 1.1.0 and its page has the updates screen.
- **Not done** – Mk II itself was committed and pushed before this check was rerun (the commit was chained after the check).

### 2026-11-04 – Mk II "In-app updates" – update file
- **Asked** – "The apk doesn't have an update function." Owner chose: self-update with .oleh files, checked only when they tap.
- **Changed** – Web (`main`): `src/updates.js` and an App Updates section in Settings (installed version, Check for Updates, Install, Install Update File…, versions on this phone with Use This Version), shown only when the app provides `window.SiddurApp`; `.btn-plain` style; `tools/build.js` adds `updates.js`; `scripts/mark.config.json` shellVersion 1.1.0. Android (`android-app`): `MarkFile.kt`, `Updater.kt`, `UpdateBridge.kt`, rewritten `MainActivity.kt` (WebViewAssetLoader origin, bridge, file picker, opening `.oleh` files), `INTERNET` permission, app 1.1.0, `tools/android-assets.js` writes `bundled-mark.json`, unit tests. Security pass (secure skill): `allowBackup="false"`, `usesCleartextTraffic="false"`, release build minified with a keep rule for the bridge. Bug found and fixed while building: `files/*.oleh` inside a Kotlin comment opened a nested comment and broke compilation.
- **Verified** – Settings screen in Chromium with a fake bridge: 13/13 (hidden without the app; up to date, available with Install, needs a newer app, offline error, install, switch version, cancelled picker, no sideways scroll; 0 errors). Android unit tests 8/8 (`./gradlew testDebugUnitTest`): reads the real Mk I file; refuses tampered (DAMAGED), wrong magic and too short (NOT_A_MARK), too-new shell (TOO_NEW), `../` and absolute paths; install switches the page and points the font at the bundled copy; an older download doesn't beat a newer built-in page unless picked; a newer APK moves past an older download; keeps the newest 5; a bad file changes nothing. Release build: dexdump shows `info`, `check`, `install`, `pickFile`, `use` kept after R8; manifest shows allowBackup false, cleartext false. Secret and logging scan of the app sources: nothing found.
- **Not done** – No emulator here, so the bridge, downloads, reload, picker and opening a `.oleh` are untested on a device. Update files are checksummed, not signed (open item 2). Phones on app 1.0 must install 1.1.0 by hand once and lose their 1.0 settings.
- **Mark file:** `marks/out/Siddur-MkII.oleh` (26 files, minimum shell 1.0.0)

### 2026-11-04 – Tilt to turn pages
- **Asked** – "Make it so you can turn the page by tilting your phone left and go to the previous page by tilting right. Make it only work if you do it hard enough so you don't accidentally turn a page."
- **Changed** – New `src/tilt.js` (flick detection on `devicemotion` rotation speed, page scroll, toast, vibration, sensor check, iOS permission); `tools/build.js` now joins `calendar.js`, `tilt.js`, `app.js`; `src/app.js` adds `tilt` and `tiltStrength` settings and calls `bindTilt()`; `src/index.html` adds the "Tilt to Turn Pages" switch, a Firm / Hard / Very Hard control and the toast; `src/app.css` adds toast and row styles plus a global `[hidden]` rule. Bug found and fixed while testing: Chromium's `DeviceMotionEvent.requestPermission()` returns "prompt" without asking, and the first version treated that as a refusal and switched tilt straight back off.
- **Verified** – Headless Chromium with simulated `devicemotion` readings at 60 Hz, feature turned on by tapping the real switch: 16/16 checks passed, on both `dist/index.html` and the Android app's bundled copy. Off: no turn. Below 300 deg/s (150 to 250): no turn. Single 500 deg/s spikes: no turn. Two readings at -350: forward 0 to 690 px with "Next page". Swing back at +350 within 1 s: ignored. +350 after the cooldown: back 690 to 0. At the top: stays, "Already at the top". Very Hard: 350 ignored, 450 turns. Finger on screen: ignored. Settings tab: ignored. Steer (alpha +350) turns forward. Separately, with no sensor readings the warning text appeared after 2.5 s. 0 script errors. Merged into `android-app`; the bundled page and `apk/siddur-debug.apk` (4,387,910 bytes) were rebuilt and the APK contains the tilt code. Artifact republished (version 3). Prayer-logic checks unchanged (Omer day 33, Purim and Chanukah Al Hanissim, notes 0/41).
- **Not done** – Not tried on a real phone, so the direction and the strength of "Hard" are untested by hand. Does not work in the claude.ai artifact (sensors blocked there). No new mark made.

### 2026-11-04 – CI: build passes, artifact upload made non-fatal
- **Asked** – Automatic: CI failure on PR #1 at commit c3cca0c.
- **Changed** – On `android-app`, `.github/workflows/android.yml`: the upload step now has `continue-on-error: true` and `retention-days: 7`. Root cause: the build itself succeeded; the upload failed with "Artifact storage quota has been hit", an account-level GitHub limit.
- **Verified** – The c3cca0c run log shows `BUILD SUCCESSFUL in 2m 46s` and `:app:assembleDebug`, so the SDK package fix works; the only error is the quota message. YAML parses.
- **Not done** – The quota itself can only be freed by the owner (delete old artifacts in GitHub settings, or wait 6 to 12 hours for usage to recalculate). The CI artifact may be missing until then; `apk/siddur-debug.apk` on the branch is the reliable copy.

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
- **Not done** – Its run then built the APK but hit the artifact quota; see the entry above.

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
