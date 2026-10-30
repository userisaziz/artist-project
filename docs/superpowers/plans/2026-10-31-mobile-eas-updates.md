# Mobile OTA Updates (EAS Update) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installed Android apps receive JS-level changes over the air (`eas update --branch preview`), with no APK rebuild or manual reinstall, and fail safe on native drift.

**Architecture:** Config-only integration of Expo EAS Update. `expo-updates` checks on every launch, downloads silently, applies on next restart. `runtimeVersion: fingerprint` hashes native config so OTA bundles are only served to matching binaries. Channels in `eas.json` bind build profiles to update branches. Zero app JS code changes (the welcome-screen marker in Tasks 3-4 is temporary verification scaffolding, reverted before the end).

**Tech Stack:** Expo SDK 57, `expo-updates`, EAS CLI 16. Spec: `docs/superpowers/specs/2026-10-31-mobile-eas-updates-design.md`.

**Repo conventions:** Work happens on `main` with Conventional Commits and path-scoped staging (never `git add .` — check `git diff --cached --name-status` before each commit). Husky runs `npm run lint` for `mobile/` paths on commit. There is no unit-test layer for config; each task's verification steps ARE the tests.

**Environment notes:**
- `mobile/android/` is gitignored prebuild output; EAS Build runs prebuild in the cloud.
- EAS account/owner is `userisaziz`; remote keystore is already set up (no local keystore).
- `adb` lives under `$ANDROID_HOME/platform-tools` (`/opt/homebrew/share/android-commandlinetools` SDK).

---

### Task 1: Install expo-updates and wire the config

**Files:**
- Modify: `mobile/package.json` (via `npx expo install`)
- Modify: `mobile/package-lock.json` (via `npx expo install`)
- Modify: `mobile/app.json`
- Modify: `mobile/eas.json`

- [ ] **Step 1: Install expo-updates**

```bash
cd /Users/almabetter/artist-project/mobile
npx expo install expo-updates
```

Expected: `package.json` gains a `expo-updates` entry in dependencies (~`57.x.x` for SDK 57), lockfile updated.

- [ ] **Step 2: Configure updates URL and runtime policy**

```bash
npx eas-cli update:configure --non-interactive
```

The CLI sets `updates.url`, defaults `runtimeVersion` to the `appVersion` policy, and adds the `channel` fields to `eas.json`. Flip the policy to `fingerprint` in `mobile/app.json` (edit the `"policy"` value directly) and verify `mobile/app.json` contains both keys inside the `"expo"` object. The two additions must read exactly:

```json
"runtimeVersion": { "policy": "fingerprint" },
"updates": {
  "url": "https://u.expo.dev/de1ea573-14b0-4ec3-929f-a7982e93bdfe"
},
```

(The URL reuses the existing `extra.eas.projectId`.)

- [ ] **Step 3: Add channels to eas.json**

Replace `mobile/eas.json` with exactly:

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "environment": "preview",
      "channel": "preview"
    },
    "production": {
      "autoIncrement": true,
      "environment": "production",
      "channel": "production"
    }
  },
  "submit": {
    "production": {}
  }
}
```

- [ ] **Step 4: Regenerate native project so local fingerprint inputs match EAS cloud**

```bash
npx expo prebuild -p android --clean
```

Expected: `android/` regenerated from the new config (dir is gitignored — `git status` must show no tracked changes from this step). This matters because the fingerprint hashes native sources, including the generated `android/` dir; a stale local copy would make local publish-time fingerprints differ from EAS-built binaries.

- [ ] **Step 5: Record the local fingerprint**

```bash
npx expo-updates fingerprint:generate --platform android
```

Expected: a JSON blob of fingerprint sources ending with a top-level `"hash"` field. **Save that hash value** (e.g. in the task notes) — Tasks 2 and 3 compare against it.

- [ ] **Step 6: Lint check**

```bash
npm run lint
```

Expected: passes (Husky will run the same gate on commit).

- [ ] **Step 7: Commit**

```bash
cd /Users/almabetter/artist-project
git add mobile/package.json mobile/package-lock.json mobile/app.json mobile/eas.json
git diff --cached --name-status
git commit -m "feat(mobile): wire EAS Update OTA with fingerprint runtime"
```

Expected: 4 files staged, commit succeeds.

---

### Task 2: Build the one-time preview APK (the last manual APK)

**Files:** none (cloud build; downloads an artifact to `mobile/builds/` which is gitignored)

- [ ] **Step 1: Confirm EAS auth**

```bash
cd /Users/almabetter/artist-project/mobile && npx eas-cli whoami
```

Expected: `userisaziz`. If not logged in: `npx eas-cli login`.

- [ ] **Step 2: Start the build (long-running — run in background)**

```bash
npx eas-cli build -p android --profile preview --non-interactive
```

Run as a background task and poll every ~2 minutes. Expected after ~15-25 min: `Build finished` with an artifact URL and a build-details URL. If it fails, read the failed log via the printed build-details URL before retrying.

- [ ] **Step 3: Record the binary's runtime version**

Open the build-details URL (or the build logs) and find the **Runtime version** / expo-updates fingerprint for this build. Expected: equals the hash saved in Task 1 Step 5. If it differs, STOP — see Troubleshooting (fingerprint mismatch) before publishing anything.

- [ ] **Step 4: Download the APK**

```bash
cd /Users/almabetter/artist-project/mobile
URL=$(npx eas-cli build:list --platform android --limit 1 --status=finished --json \
  | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['artifact']['buildUrl'])")
mkdir -p builds
curl -L -o builds/getready-ota-baseline.apk "$URL"
ls -lh builds/getready-ota-baseline.apk
```

Expected: a file of roughly 40-90 MB. (If the JSON shape differs in your CLI version, print `json.load(sys.stdin)[0]` and locate the URL key.)

- [ ] **Step 5: Install on a device**

```bash
adb devices          # expect one device listed; else send the artifact URL to a tester and use their device
adb install -r builds/getready-ota-baseline.apk
```

Expected: `Success`. If you get `INSTALL_FAILED_UPDATE_INCOMPATIBLE` (signing-key drift from an older install): `adb uninstall com.userisaziz.artcircle` then re-run the install.

- [ ] **Step 6: Baseline sanity on device**

```bash
adb shell am start -n com.userisaziz.artcircle/.MainActivity
```

Expected: app opens; Welcome screen renders (or login/home when signed in) and, when signed in, data loads. Note the Welcome body copy currently reads `Mehendi, makeup, photography and more, booked in minutes.` — no `[OTA]` marker.

---

### Task 3: First OTA publish + two-restart pickup verification

**Files:**
- Modify: `mobile/app/(auth)/welcome.tsx` (temporary marker, reverted in Step 8)

- [ ] **Step 1: Pre-publish fingerprint check**

```bash
npx expo-updates fingerprint:generate --platform android
```

Expected: equals the binary's runtime version recorded in Task 2 Step 3. **Do not publish until equal** (mismatch = the OTA would be silently ignored by every device).

- [ ] **Step 2: Record the reference API URL**

```bash
npx eas-cli env:list --environment preview
```

Expected: shows `EXPO_PUBLIC_API_URL` (and `GOOGLE_MAPS_ANDROID_API_KEY`). Save the API URL value for Step 7.

- [ ] **Step 3: Add the visible marker**

In `mobile/app/(auth)/welcome.tsx`, change the body copy (line 44):

```tsx
// before
          Mehendi, makeup, photography and more, booked in minutes.
// after
          Mehendi, makeup, photography and more, booked in minutes. [OTA]
```

- [ ] **Step 4: Commit the marker**

```bash
cd /Users/almabetter/artist-project
git add "mobile/app/(auth)/welcome.tsx"
git diff --cached --name-status
git commit -m "chore(mobile): add OTA pickup marker on welcome screen"
```

- [ ] **Step 5: Publish the update**

```bash
cd mobile
npx eas-cli update --branch preview --message "OTA pickup marker"
```

Expected: output shows the computed fingerprint and `Committed update` / an update group id. If the CLI prompts about uncommitted changes, abort and commit/push first — never publish from a dirty tree.

- [ ] **Step 6: Confirm the served update**

```bash
npx eas-cli update:list --branch preview
```

Expected: lists the new update, Runtime column matching the fingerprint from Step 1.

- [ ] **Step 7: Two-restart pickup + API URL safeguard on device**

```bash
adb shell am force-stop com.userisaziz.artcircle
adb shell am start -n com.userisaziz.artcircle/.MainActivity   # launch 1: downloads in background
sleep 15
adb shell am force-stop com.userisaziz.artcircle
adb shell am start -n com.userisaziz.artcircle/.MainActivity   # launch 2: applies the update
```

Expected: Welcome body now shows `... booked in minutes. [OTA]`. If signed in, first log out (Profile tab → **Log out**) so the Welcome screen shows. Then sign back in / browse the home feed: **data must load** — this proves the OTA bundle's `EXPO_PUBLIC_API_URL` matches the APK's backend. If network calls fail, the bundle got the wrong URL: `EXPO_PUBLIC_API_URL=<value from Step 2> npx eas-cli update --branch preview --message "fix api url"` and re-verify.

- [ ] **Step 8: Remove the marker and republish clean state**

Restore the line to `Mehendi, makeup, photography and more, booked in minutes.`, then:

```bash
cd /Users/almabetter/artist-project
git add "mobile/app/(auth)/welcome.tsx"
git diff --cached --name-status
git commit -m "chore(mobile): remove OTA pickup marker"
cd mobile && npx eas-cli update --branch preview --message "remove OTA marker"
```

Device check: after two restarts the marker is gone again.

---

### Task 4: Fingerprint guard verification (native drift → OTA ignored)

**Files:**
- Modify: `mobile/app.json` (temporary, reverted in Step 5)
- Modify: `mobile/app/(auth)/welcome.tsx` (temporary, reverted in Step 5)

- [ ] **Step 1: Change one native config value**

In `mobile/app.json`, change `android.adaptiveIcon.backgroundColor` from `#B64D75` to `#B64D76` (visually identical, fingerprint-relevant).

- [ ] **Step 2: Add a second marker**

In `mobile/app/(auth)/welcome.tsx`, change the body to:

```tsx
          Mehendi, makeup, photography and more, booked in minutes. [OTA-2]
```

- [ ] **Step 3: Confirm the fingerprint actually moved**

```bash
npx expo prebuild -p android --clean
npx expo-updates fingerprint:generate --platform android  # expected: DIFFERENT from the recorded build fingerprint
```

- [ ] **Step 4: Commit the temporary test changes**

```bash
cd /Users/almabetter/artist-project
git add mobile/app.json "mobile/app/(auth)/welcome.tsx"
git diff --cached --name-status
git commit -m "chore(mobile): temporary fingerprint guard test"
```

- [ ] **Step 5: Publish the mismatched update**

```bash
cd mobile
npx eas-cli update --branch preview --message "fingerprint guard test"
```

Expected: publish succeeds but the CLI warns the fingerprint matches no existing build/runtime.

- [ ] **Step 6: Device does NOT pick it up**

```bash
adb shell am force-stop com.userisaziz.artcircle
adb shell am start -n com.userisaziz.artcircle/.MainActivity
sleep 15
adb shell am force-stop com.userisaziz.artcircle
adb shell am start -n com.userisaziz.artcircle/.MainActivity
```

Expected (guard works): Welcome body does **not** show `[OTA-2]` — the device keeps the compatible bundle.

- [ ] **Step 7: Revert and restore service**

Revert `mobile/app.json` (`#B64D76` → `#B64D75`) and the welcome body back to `... booked in minutes.` (no marker), then:

```bash
cd /Users/almabetter/artist-project
git add mobile/app.json "mobile/app/(auth)/welcome.tsx"
git diff --cached --name-status
git commit -m "chore(mobile): revert fingerprint guard test"
cd mobile
npx expo prebuild -p android --clean
npx expo-updates fingerprint:generate --platform android  # expected: matches the build fingerprint again
npx eas-cli update --branch preview --message "restore matching fingerprint"
```

Device: two restarts → app normal, no marker.

---

### Task 5: Rollback drill

**Files:** none

- [ ] **Step 1: Exercise republish**

```bash
cd /Users/almabetter/artist-project/mobile
npx eas-cli update:republish --branch preview
```

Interactive: select the newest update group. Expected: `Republished` confirmation. (This re-points the channel at that group — the operation you'd use in seconds if a bad OTA ever shipped.)

- [ ] **Step 2: Confirm no behavior change**

Two force-stop/relaunch cycles on the device. Expected: app unchanged and functional.

- [ ] **Step 3: Done — no commits**

No file changes in this task. The OTA pipeline is live: JS changes now ship with `npx eas-cli update --branch preview`; native changes still require `npx eas-cli build -p android --profile preview`.

---

## Troubleshooting

- **Local fingerprint ≠ binary runtime version.** Causes, in order of likelihood: (1) stale local `android/` — re-run `npx expo prebuild -p android --clean` and re-hash; (2) env-dependent resolved config — `mobile/app.config.ts` injects `GOOGLE_MAPS_ANDROID_API_KEY` and `EAS_PROJECT_ID` from the environment, so a key present locally (`mobile/.env.local`) but absent in the EAS `preview` environment (or vice versa) changes the resolved config and the fingerprint. Compare `npx eas-cli env:list --environment preview` against local values, align them, re-hash; a rebuilt APK is required if the binary's runtime differs from what you need to publish against.
- **`adb` not found** — use `/opt/homebrew/share/android-commandlinetools/platform-tools/adb`.
- **`eas update` asks about uncommitted changes** — stop, commit the work (path-scoped), then publish; never publish a dirty tree for this feature.
- **Device never downloads** — verify the binary was built AFTER Task 1 committed (older APKs have no channel embedded) and that the device has network; check `npx eas-cli update:list --branch preview` shows a runtime matching the binary.
