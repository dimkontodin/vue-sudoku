# Releasing the Android app

A git tag `vX.Y.Z` is the single source of truth for the version. Pushing it makes CI build a signed
Android App Bundle (`.aab`) and attach it to a GitHub Release. You upload that file to the Play
Console by hand.

## Versioning

| Android field | Value                             | Example (tag `v1.2.0`) |
| ------------- | --------------------------------- | ---------------------- |
| `versionName` | the tag without `v`               | `1.2.0`                |
| `versionCode` | `major*10000 + minor*100 + patch` | `10200`                |

Play rejects an upload whose `versionCode` is not higher than every earlier upload, so never reuse
or lower a version. Minor and patch must stay at or below 99. To re-release the same changes, bump
the patch (`v1.2.1`). The `package.json` versions are private placeholders and do not matter for the
store.

Local builds without `-PversionName` / `-PversionCode` get `0.0.0-dev` / `1`.

## One-time setup

1. **Create an upload keystore** (keep it out of the repo, `*.jks` is gitignored):
   ```bash
   keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
2. **Back up** `upload.jks`, its passwords and the alias in a password manager.
3. Enrol the app in **Play App Signing** when you create it in the Play Console (the default).
   Google keeps the real signing key, and this keystore is only the _upload_ key.
4. Add these repository secrets (Settings → Secrets and variables → Actions):
   - `ANDROID_KEYSTORE_BASE64`: `base64 -w0 upload.jks` (on Windows PowerShell:
     `[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.jks"))`)
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`

## Cutting a release

```bash
git tag v0.1.0
git push origin v0.1.0
```

The [Release Android](../.github/workflows/release-android.yml) workflow builds the bundle and
creates the GitHub Release with `sudoku-0.1.0.aab` attached. Then upload it in the Play Console
(Internal testing first), and write the "What's new" text by hand.

To try the pipeline without releasing, run the workflow manually (Actions → Release Android → Run
workflow) with a version. It uploads the bundle as a workflow artifact and creates no release.

## Building locally

Needs JDK 21 and the Android SDK (`ANDROID_HOME`).

```bash
# Unsigned release bundle (no keystore configured)
pnpm nx run @vue-sudoku/sudoku-mobile:android-bundle

# Signed: create apps/sudoku-mobile/android/app/keystore.properties (gitignored)
#   storeFile=/absolute/path/to/upload.jks
#   storePassword=…
#   keyAlias=upload
#   keyPassword=…
# or export ANDROID_KEYSTORE_PATH / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD.

# Pick a version explicitly
ANDROID_VERSION_NAME=1.2.0 ANDROID_VERSION_CODE=10200 pnpm nx run @vue-sudoku/sudoku-mobile:android-bundle
```

The bundle lands in `apps/sudoku-mobile/android/app/build/outputs/bundle/release/app-release.aab`.
`android-apk` builds a release APK instead, which is handy for sideloading to a device. It is only
installable if it is signed.

## Play Console checklist

- Developer account (one-time fee, identity verification). New personal accounts may have to run a
  closed test with a minimum number of testers for a minimum period before production access. Check
  the current rule in the Play Console help.
- Store listing: title, short and full description, 512×512 icon, 1024×500 feature graphic, at
  least two phone screenshots, category (Puzzle), contact email and the privacy policy URL
  `https://dimkontodin.github.io/vue-sudoku/privacy.html`.
- App content: Data safety (no data collected or shared), content rating, ads (none), target
  audience.
- Upload the `.aab` to Internal testing, then Closed testing, then Production.
