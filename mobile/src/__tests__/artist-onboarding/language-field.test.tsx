import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { LanguageField } from '../../components/artist-onboarding/LanguageField';
import { LANGUAGES } from '../../utils/artist-onboarding/profile-details';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const LABEL = 'Languages you speak';
// The field's name grows with the selection, so one prefix finds it in every state.
const field = () => screen.getByRole('button', { name: new RegExp(`^${LABEL}`) });
const row = (language: string) => screen.queryByRole('checkbox', { name: language });
/** What a screen reader would read out for the field, which is the selection in pick order. */
const announced = () => field().props.accessibilityLabel;

function Harness({ initial = [] }: { initial?: string[] }) {
  const [languages, setLanguages] = useState<string[]>(initial);
  return (
    <LanguageField label={LABEL} languages={languages} options={LANGUAGES} onChange={setLanguages} />
  );
}

beforeEach(async () => {
  await render(<ThemeProvider><Harness /></ThemeProvider>);
});

it('shows a placeholder, and hides the list until the field is pressed', () => {
  expect(screen.getByText('Choose the languages you speak')).toBeTruthy();
  expect(row('Hindi')).toBeNull();
});

it('a tap in the sheet adds the language and stays open for the next one', async () => {
  await fireEvent.press(field());
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Hindi' }));

  expect(announced()).toBe('Languages you speak: Hindi');
  expect(screen.getByRole('checkbox', { name: 'Hindi' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy(); // still open, unlike the city picker
});

it('tapping a checked language in the sheet takes it back off', async () => {
  await fireEvent.press(field());
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Hindi' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Hindi' }));

  expect(announced()).toBe(LABEL);
  expect(screen.getByRole('checkbox', { name: 'Hindi' })).not.toBeChecked();
});

it('keeps the languages in the order the artist picked them', async () => {
  await fireEvent.press(field());
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Hindi' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'English' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Tamil' }));

  expect(announced()).toBe('Languages you speak: Hindi, English, Tamil');
});

it('the badge removes a language without opening the sheet', async () => {
  await fireEvent.press(field());
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Hindi' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Hindi' }));

  expect(screen.getByText('Choose the languages you speak')).toBeTruthy();
  expect(row('Hindi')).toBeNull(); // the sheet is shut, and the badge did not reopen it
});
