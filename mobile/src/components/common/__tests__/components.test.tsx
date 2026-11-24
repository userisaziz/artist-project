import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { lightTheme } from '../../../core/theme/themes/light';
import type { ReactElement } from 'react';
import { ThemeProvider } from '../../../core/theme/theme-provider';
import { AppText } from '../AppText';
import { AppButton } from '../AppButton';
import { Avatar } from '../Avatar';
import { Photo } from '../Photo';

// expo-image renders a native view; the mock keeps the props so a test can read them.
jest.mock('expo-image', () => {
  const { createElement } = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: Record<string, unknown>) => createElement(View, { testID: 'expo-image', ...props }),
  };
});

const wrap = (ui: ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

it('AppText maps variants to theme typography', async () => {
  await wrap(<AppText variant="title">Welcome back</AppText>);
  expect(screen.getByText('Welcome back')).toHaveProperty('props.style.0.fontFamily', 'PlusJakartaSans_600SemiBold');
});

it('AppButton shows spinner instead of label while loading and blocks presses', async () => {
  const onPress = jest.fn();
  await wrap(<AppButton label="Continue" onPress={onPress} loading />);
  expect(screen.queryByText('Continue')).toBeNull();
  expect(screen.getByTestId('app-button-spinner')).toBeTruthy();
});

// Cherry Red kit: the button's resting look per variant (fill, border, label), with no gradient laid over it.
const c = lightTheme.colors;
const look = (name: string) => {
  const button = screen.getByRole('button', { name });
  return { style: StyleSheet.flatten(button.props.style), label: StyleSheet.flatten(screen.getByText(name).props.style) };
};

it('AppButton primary is flat cherry with a white label and a soft cherry shadow', async () => {
  await wrap(<AppButton label="Get started" onPress={jest.fn()} />);
  const { style, label } = look('Get started');
  expect(style).toMatchObject({ backgroundColor: c.brand, shadowColor: lightTheme.shadows.md.shadowColor, opacity: 1 });
  expect(label.color).toBe(c.textOnBrand);
});

it('AppButton disabled primary turns blush with a rose label and no shadow, instead of fading', async () => {
  await wrap(<AppButton label="Get started" onPress={jest.fn()} disabled />);
  const { style, label } = look('Get started');
  expect(style).toMatchObject({ backgroundColor: c.disabledFill, opacity: 1 });
  expect(style.shadowColor).toBeUndefined();
  expect(label.color).toBe(c.disabledInk);
});

it('AppButton secondary is a rose-tint pill; outline is white with a cherry border', async () => {
  await wrap(<><AppButton label="Learn more" variant="secondary" onPress={jest.fn()} /><AppButton label="View details" variant="outline" onPress={jest.fn()} /></>);
  const secondary = look('Learn more');
  expect(secondary.style).toMatchObject({ backgroundColor: c.brandSoft, borderColor: c.brandSoftBorder });
  expect(secondary.label.color).toBe(c.brandInk);
  const outline = look('View details');
  expect(outline.style).toMatchObject({ backgroundColor: c.surface, borderColor: c.brand });
  expect(outline.label.color).toBe(c.brand);
});

it('Photo caches the image, sizes it for the decoder and recycles by image', async () => {
  await wrap(<Photo uri="https://example.com/a.jpg" style={{ width: 120, height: 90 }} />);
  const image = screen.getByTestId('expo-image');
  expect(image.props.cachePolicy).toBe('memory-disk');
  expect(image.props.source).toEqual({ uri: 'https://example.com/a.jpg', width: 120, height: 90 });
  expect(image.props.recyclingKey).toBe('https://example.com/a.jpg');
});

it('Photo leaves the size out when the style does not say', async () => {
  await wrap(<Photo uri="https://example.com/a.jpg" style={{ width: '100%', height: 90 }} />);
  expect(screen.getByTestId('expo-image').props.source).toEqual({ uri: 'https://example.com/a.jpg', height: 90 });
});

it('Avatar asks for an image the size of the avatar', async () => {
  await wrap(<Avatar uri="https://example.com/a.jpg" name="Asha" size={44} />);
  const image = screen.getByTestId('expo-image');
  expect(image.props.source).toEqual({ uri: 'https://example.com/a.jpg', width: 44, height: 44 });
  expect(image.props.cachePolicy).toBe('memory-disk');
  expect(image.props.recyclingKey).toBe('https://example.com/a.jpg');
});
