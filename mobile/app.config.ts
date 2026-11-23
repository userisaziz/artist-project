import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the static config; this adds what must not be committed. EAS_PROJECT_ID (from `eas init`) lets
// devices register for push. The Location step's map (MapLibre + OpenFreeMap tiles) needs no key on either platform.
export default ({ config }: ConfigContext): ExpoConfig => {
  const easProjectId = process.env.EAS_PROJECT_ID;
  return {
    ...(config as ExpoConfig),
    extra: {
      ...config.extra,
      ...(easProjectId ? { eas: { ...config.extra?.eas, projectId: easProjectId } } : {}),
    },
  };
};
