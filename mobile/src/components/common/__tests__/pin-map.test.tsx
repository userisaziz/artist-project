import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../core/theme/theme-provider';
import { PinMap } from '../PinMap';

// jest-setup.ts renders MapLibre's Map as a plain View, so the native event can be fired at it by hand.

it('reports the point under the pin as latitude/longitude (MapLibre sends [longitude, latitude])', async () => {
  const onMove = jest.fn();
  await render(<ThemeProvider><PinMap start={{ latitude: 12.93, longitude: 77.62 }} onMove={onMove} /></ThemeProvider>);

  const map = screen.getByLabelText('Map. Move it so the pin sits on your studio.').children[0];
  if (typeof map === 'string') throw new Error('expected the map view, not text');
  await fireEvent(map, 'regionDidChange', { nativeEvent: { center: [77.6245, 12.9352], zoom: 16 } });

  expect(onMove).toHaveBeenCalledWith({ latitude: 12.9352, longitude: 77.6245 });
});
