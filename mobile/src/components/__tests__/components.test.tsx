import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { ThemeProvider } from '../../theme/theme-provider';
import { AppText } from '../AppText';
import { AppButton } from '../AppButton';

const wrap = (ui: ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

it('AppText maps variants to theme typography', async () => {
  await wrap(<AppText variant="title">Welcome back</AppText>);
  expect(screen.getByText('Welcome back')).toHaveProperty('props.style.0.fontFamily', 'CormorantGaramond_600SemiBold');
});

it('AppButton shows spinner instead of label while loading and blocks presses', async () => {
  const onPress = jest.fn();
  await wrap(<AppButton label="Continue" onPress={onPress} loading />);
  expect(screen.queryByText('Continue')).toBeNull();
  expect(screen.getByTestId('app-button-spinner')).toBeTruthy();
});
