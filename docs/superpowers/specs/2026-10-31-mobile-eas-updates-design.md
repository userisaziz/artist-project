# Mobile OTA Updates via EAS Update — Design

## Problem

Every JS-level change to the mobile app today requires a fresh APK (`npx eas build -p android --profile
preview`) and a manual reinstall by every tester/client. There is no update mechanism: `expo-updates` is
not installed, `app.json` has no `updates` config, and `eas.json` profiles have no channels.

Distribution is Android APK via EAS cloud builds (`preview` profile, internal distribution, EAS-managed
keystore). `mobile/android/` is gitignored prebuild output; EAS Build runs prebuild on its servers.

## Goal

JS/asset changes reach installed apps without building or reinstalling an APK: publish one command
(`eas update --branch preview`), and every installed app picks up the new bundle silently on its next
launch. Native changes (new native module, permission, plugin/native config change, SDK bump) still
require a new APK — detected automatically, never breaking an installed app.

## Chosen approach

Expo EAS Update with silent download + apply-on-restart. Zero app JS code changes — `expo-updates`
checks on every launch by default, downloads in the background, and loads the new bundle the next time
the app starts. (Rejected: update-ready prompt UI — unneeded friction for a tester circle; Play-Store
in-app update API — requires store distribution; min-version/force-update gate — different problem,
not requested.)

## Configuration changes (mobile only)

| File | Change |
| --- | --- |
| `mobile/package.json` | `npx expo install expo-updates` |
| `mobile/app.json` | `eas update:configure` adds `"updates": { "url": "https://u.expo.dev/de1ea573-14b0-4ec3-929f-a7982e93bdfe" }` (reuses existing `extra.eas.projectId`). Add `"runtimeVersion": { "policy": "fingerprint" }`. |
| `mobile/eas.json` | `preview` profile: `"channel": "preview"`; `production` profile: `"channel": "production"` |

**Fingerprint runtime policy (decision):** the runtime version is a hash of the native config. An OTA
update is served only to binaries whose fingerprint matches the one it was published against. Native
drift therefore fails safe — devices simply keep the current bundle until a new APK is built and the
CLI output makes the mismatch visible. (Rejected: default `appVersion` policy — `version` stays
"1.0.0" while `versionCode` auto-increments under `appVersionSource: remote`, so it signals neither
native drift nor compatibility.)

## Publish flow (after one-time setup)

1. One final manual APK: `npx eas build -p android --profile preview` — this binary embeds
   `expo-updates`, the `u.expo.dev` URL, and channel `preview`. Testers install it once; it is the
   last APK needed for JS-only changes.
2. JS/asset change ships with: `eas update --branch preview` (push the commit first — the update is
   labeled with the git commit hash, and the CLI prompts when the working tree is dirty).
3. Fingerprint mismatch (native change happened): the update publishes but matches no binary; run
   `npx eas build -p android --profile preview` for a new APK instead.

## Failure handling and rollback

- Launch with no network → app runs the last-good bundle; the check retries next launch. No UI, no
  spinner, no added failure mode.
- Bad OTA shipped → `eas update:republish --branch preview` re-points the channel at the previous
  update within seconds (faster than any APK rebuild).
- `EXPO_PUBLIC_API_URL` safeguard: `eas update` builds the JS bundle at publish time and links to the
  channel's build-profile environment. On the first publish we verify the served bundle targets the
  same backend as the APK before announcing it to testers; if the profile env is not injected, fall
  back to exporting the correct `EXPO_PUBLIC_API_URL` in the publishing shell and re-verify.

## Testing and verification

1. Build `preview` APK with the new config, install on a device.
2. Make a trivial visible JS change (a text string), commit, `eas update --branch preview`.
3. Open the app (background download), force-quit, relaunch → change visible (two-restart semantics).
4. `eas update:list --branch preview` shows the served update against the APK's fingerprint/runtime.
5. Publish again with a deliberately changed native config → confirm the device does NOT pick it up
   (fingerprint guard works) and the CLI flags the mismatch.

## Out of scope

- In-app update UI, forced-update/min-version gates, backend version endpoint.
- iOS/TestFlight (the same config carries over unchanged when iOS builds start).
- Local `./gradlew` debug builds — they don't receive OTA (dev flow is `expo start`; only EAS-built
  binaries carry the channel).

## Risks

- EAS Update free tier limits are generous; a tester circle is far below them.
- A bad OTA affects every app that launches before rollback; mitigated by the republish path and by
  keeping updates small and frequent.
- The two-restart semantics can confuse testers ("did the fix land?") — mitigate with the commit-hash
  label visible in `eas update:list` when in doubt.
