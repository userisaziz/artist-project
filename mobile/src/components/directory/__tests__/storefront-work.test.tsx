import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { ThemeProvider } from '../../../core/theme/theme-provider';
import { StorefrontWork } from '../StorefrontWork';
import type { ArtistPublic } from '../../../types/directory/directory';

// expo-image talks to native modules; the tests only need a plain host view.
jest.mock('expo-image', () => ({ Image: require('react-native').View }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const photos: ArtistPublic['photos'] = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i}`,
  url: `https://cdn.test/${i}.jpg`,
  thumb_url: `https://cdn.test/${i}-thumb.jpg`,
}));

const wrap = (ui: ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

it('the scrim-styled "See all" tile opts out of press feedback (no grey flash)', async () => {
  await wrap(<StorefrontWork photos={photos} />);
  // feedback is consumed by PressableFeedback; the visible contract is that no
  // ripple/dim machinery is wired up on the host control.
  expect(screen.getByLabelText('See all 8 photos').props.android_ripple).toBeUndefined();
});

it('tapping "See all" reveals the remaining photos', async () => {
  await wrap(<StorefrontWork photos={photos} />);
  await fireEvent.press(screen.getByLabelText('See all 8 photos'));
  expect(screen.queryByLabelText('See all 8 photos')).toBeNull();
});

it('opens a tapped photo full screen and closes again', async () => {
  await wrap(<StorefrontWork photos={photos} />);
  await fireEvent.press(screen.getByLabelText('Work photo 2, open full screen'));
  expect(screen.getByText('2 of 8')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Close photos'));
  expect(screen.queryByText('2 of 8')).toBeNull();
});

it('folds an expanded grid back with "Show less"', async () => {
  await wrap(<StorefrontWork photos={photos} />);
  await fireEvent.press(screen.getByLabelText('See all 8 photos'));
  expect(screen.getByLabelText('Work photo 8, open full screen')).toBeTruthy();
  await fireEvent.press(screen.getByText('Show less'));
  expect(screen.getByLabelText('See all 8 photos')).toBeTruthy();
  expect(screen.queryByLabelText('Work photo 8, open full screen')).toBeNull();
});
