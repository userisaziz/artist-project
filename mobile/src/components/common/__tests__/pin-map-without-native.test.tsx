import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../core/theme/theme-provider';
import { PinMap } from '../PinMap';

// A binary without MapLibre (Expo Go, or a dev client built before the library landed) throws the moment the
// library is imported. expo-router imports every route file at boot, so that throw must not leave the app dead.
jest.mock('@maplibre/maplibre-react-native', () => {
  throw new Error("TurboModuleRegistry.getEnforcing(...): 'MLRNCameraModule' could not be found.");
});

it('stands in with a placeholder instead of crashing the app', async () => {
  await render(<ThemeProvider><PinMap start={{ latitude: 12.93, longitude: 77.62 }} onMove={jest.fn()} /></ThemeProvider>);

  expect(screen.getByLabelText('Map unavailable in this build')).toBeTruthy();
  expect(screen.getByText('12.93000, 77.62000')).toBeTruthy(); // the pin's point stays readable
});
