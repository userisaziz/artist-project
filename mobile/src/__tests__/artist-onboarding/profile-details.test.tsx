import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { ProfileDetailsFields } from '../../components/artist-onboarding/ProfileDetailsFields';
import { LANGUAGES, parseExperience } from '../../utils/artist-onboarding/profile-details';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

it('reads years of experience: blank is none, whole years up to 60, anything else is a mistake', () => {
  expect(parseExperience('')).toEqual({ ok: true, value: null });
  expect(parseExperience(' 8 ')).toEqual({ ok: true, value: 8 });
  expect(parseExperience('0')).toEqual({ ok: true, value: 0 });
  expect(parseExperience('61')).toEqual({ ok: false, error: 'Enter your years of experience as a number from 0 to 60.' });
  expect(parseExperience('2.5').ok).toBe(false);
  expect(parseExperience('ten').ok).toBe(false);
});

it('offers the same languages as the backend', () => {
  expect(LANGUAGES).toEqual(['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu']);
});

function Harness({ onChange }: { onChange: (experience: string, languages: string[]) => void }) {
  const [experience, setExperience] = useState('');
  const [languages, setLanguages] = useState<string[]>(['Hindi']);
  return (
    <ProfileDetailsFields
      experience={experience}
      onExperienceChange={(text) => { setExperience(text); onChange(text, languages); }}
      languages={languages}
      onLanguagesChange={(next) => { setLanguages(next); onChange(experience, next); }}
    />
  );
}

it('the artist types their experience and toggles languages in the order they pick them', async () => {
  const onChange = jest.fn();
  await render(<ThemeProvider><Harness onChange={onChange} /></ThemeProvider>);

  await fireEvent.changeText(screen.getByLabelText('Years of experience'), '8');
  await fireEvent.press(screen.getByRole('button', { name: /^Languages you speak/ })); // opens the sheet
  await fireEvent.press(screen.getByRole('checkbox', { name: 'English' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Hindi' }));

  expect(onChange).toHaveBeenNthCalledWith(1, '8', ['Hindi']);
  expect(onChange).toHaveBeenNthCalledWith(2, '8', ['Hindi', 'English']);
  expect(onChange).toHaveBeenLastCalledWith('8', ['English']);
  expect(screen.getByRole('checkbox', { name: 'English' })).toBeChecked();
});
