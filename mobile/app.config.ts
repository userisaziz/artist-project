import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the static config; this adds what must not be committed. The Android Google Maps key (for the
// Location step's map pin) comes from the environment: a local .env for dev builds, an EAS secret for releases.
// iOS uses Apple Maps and needs no key. EAS_PROJECT_ID (from `eas init`) lets devices register for push.
export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const easProjectId = process.env.EAS_PROJECT_ID;
  return {
    ...(config as ExpoConfig),
    extra: {
      ...config.extra,
      ...(easProjectId ? { eas: { ...config.extra?.eas, projectId: easProjectId } } : {}),
    },
    android: {
      ...config.android,
      config: { ...config.android?.config, ...(mapsKey ? { googleMaps: { apiKey: mapsKey } } : {}) },
    },
  };
};
