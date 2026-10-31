import { render, renderHook, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AppText } from '../AppText';
import { CollapseOnScroll, Parallax, useScrollLinked } from '../ScrollMotion';
import { ThemeProvider } from '../../../core/theme/theme-provider';

const wrap = (ui: ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

/** The hook owns the shared value; components take it as a prop, so tests drive it through a host. */
function Host({ children }: { children: (scroll: ReturnType<typeof useScrollLinked>) => ReactElement }) {
  const scroll = useScrollLinked();
  return children(scroll);
}

it('useScrollLinked wires the frame-rate throttle and a live scroll value', async () => {
  const { result } = await renderHook(() => useScrollLinked());
  expect(result.current.scrollEventThrottle).toBe(16);
  expect(result.current.scrollY.get()).toBe(0);
});

it('CollapseOnScroll keeps its children mounted under an animated style', async () => {
  await wrap(
    <Host>{({ scrollY }) => <CollapseOnScroll scrollY={scrollY}><AppText>Explore</AppText></CollapseOnScroll>}</Host>,
  );
  expect(screen.getByText('Explore')).toBeTruthy();
});

it('Parallax clips its children to a fixed-height box', async () => {
  await wrap(
    <Host>{({ scrollY }) => <Parallax scrollY={scrollY} height={250}><AppText>Hero photo</AppText></Parallax>}</Host>,
  );
  const box = screen.getByText('Hero photo').parent?.parent;
  expect(box?.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ height: 250, overflow: 'hidden' })]));
});
