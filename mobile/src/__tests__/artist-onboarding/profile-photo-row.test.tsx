import type { ReactElement } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../core/theme/theme-provider';
import ProfileStep from '../../../app/artist/onboarding/profile';

const mockPickImages = jest.fn();
jest.mock('../../api/artist-onboarding/upload', () => ({ pickImages: (...args: unknown[]) => mockPickImages(...args) }));
jest.mock('expo-image', () => ({ Image: require('react-native').View }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), dismissTo: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../../context/artist-onboarding/flow-context', () => ({ useArtistFlow: () => ({ editing: false }) }));
jest.mock('../../hooks/catalog/catalog', () => ({
  useCategories: () => ({ data: [{ id: 1, name: 'Bridal' }], isError: false }),
  useCities: () => ({ data: ['Mumbai'], isError: false }),
}));
// No saved profile yet: the row reads "Add profile photo".
jest.mock('../../hooks/artist-onboarding/artist-onboarding', () => ({
  useArtistProfile: () => ({ data: undefined }),
  useSaveProfile: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useUploadPhoto: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

const originalOS = Platform.OS;
afterEach(() => { Platform.OS = originalOS; mockPickImages.mockReset(); });

let client: QueryClient;
const wrap = (ui: ReactElement) => render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);
beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }); });
afterEach(() => client.clear());

const touch = { nativeEvent: { touches: [], changedTouches: [], identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0, timestamp: 0 }, persist: () => {} };
const row = () => screen.getByLabelText('Add profile photo');

// The row is a photo + label with no surface of its own, so a bounded wash painted across its
// rectangle reads as a grey bar appearing behind the avatar (the reported Android symptom).
it('shows no Android ripple across the photo row', async () => {
  Platform.OS = 'android';
  await wrap(<ProfileStep />);
  expect(row().props.nativeForegroundAndroid).toBeUndefined();
});

it('does not dim the photo row under the finger', async () => {
  Platform.OS = 'ios';
  await wrap(<ProfileStep />);
  await act(async () => { fireEvent(row(), 'responderGrant', touch); });
  expect(StyleSheet.flatten(row().props.style)?.opacity).toBeUndefined();
});

it('still answers a press by opening the picker', async () => {
  Platform.OS = 'ios';
  mockPickImages.mockResolvedValue([]);
  await wrap(<ProfileStep />);
  await fireEvent.press(row());
  await waitFor(() => expect(mockPickImages).toHaveBeenCalledWith(1));
});
