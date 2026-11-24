import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { HomeHero, type HeroSlide } from '../../components/directory/HomeHero';

jest.mock('expo-image', () => ({ Image: jest.requireActual('react-native').View }));

const BRIDAL: HeroSlide = { eyebrow: 'MEHENDI', title: 'Bridal mehendi artists', categorySlug: 'mehendi', image: { uri: 'bridal' } };
const GLAM: HeroSlide = { eyebrow: 'MAKEUP & HAIR', title: 'Glam for your big day', categorySlug: 'makeup', image: { uri: 'glam' } };

function Hero({ slides }: { slides: HeroSlide[] }) {
  const scrollY = useSharedValue(0);
  return <ThemeProvider><HomeHero slides={slides} onOpen={jest.fn()} scrollY={scrollY} /></ThemeProvider>;
}

beforeEach(() => { jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true); }); // no auto-advance

it('falls back to the first slide when Home drops the one on screen (it used to throw and crash Home)', async () => {
  const view = await render(<Hero slides={[BRIDAL, GLAM]} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Slide 2 of 2' }));
  expect(screen.getByText('Glam for your big day')).toBeTruthy();

  // Artists loaded and nobody nearby offers makeup: only the mehendi slide stays.
  await view.rerender(<Hero slides={[BRIDAL]} />);

  expect(screen.getByText('Bridal mehendi artists')).toBeTruthy();
  expect(screen.queryByText('Glam for your big day')).toBeNull();
});

it('renders nothing with no slides', async () => {
  await render(<Hero slides={[]} />);
  expect(screen.queryByRole('button', { name: /Explore artists/ })).toBeNull();
});
