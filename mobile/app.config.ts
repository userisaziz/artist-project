import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the static config; this adds what must not be committed. The Android Google Maps key (for the
// Location step's map pin) comes from the environment: a local .env for dev builds, an EAS secret for releases.
// iOS uses Apple Maps and needs no key.
export default ({ config }: ConfigContext): ExpoConfig => {
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  return {
    ...(config as ExpoConfig),
    android: {
      ...config.android,
      config: { ...config.android?.config, ...(mapsKey ? { googleMaps: { apiKey: mapsKey } } : {}) },
    },
  };
};
