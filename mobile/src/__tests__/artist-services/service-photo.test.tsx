import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { CustomServiceSheet } from '../../components/artist-services/CustomServiceSheet';
import { customServiceFixture } from '../../mocks/artist-onboarding/artist-onboarding';
import { uploadImage } from '../../api/artist-onboarding/upload';
import type { ServiceItem } from '../../types/artist-onboarding/artist-onboarding';
import type { CatalogCategory } from '../../types/catalog/catalog';

jest.mock('../../api/artist-onboarding/upload', () => ({
  pickImages: jest.fn(async () => [{ uri: 'file://package.jpg', width: 1200, height: 1500 }]),
  uploadImage: jest.fn(async () => ({ key: 'artists/u1/service/abc', width: 1200, height: 1500 })),
}));

const tree: CatalogCategory[] = [
  { id: 1, slug: 'mehendi', name: 'Mehendi', subcategories: [{ id: 101, slug: 'mehendi-bridal', name: 'Bridal', services: [] }] },
];
const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const withPhoto: ServiceItem = { ...customServiceFixture, subcategory_id: 101, category_id: 101, photo_url: 'https://fake.storage/card/old.jpg' };

async function renderSheet(service?: ServiceItem) {
  const onSubmit = jest.fn(async (_input: unknown) => {});
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider><CustomServiceSheet categories={tree} service={service} onClose={jest.fn()} onSubmit={onSubmit} /></ThemeProvider>
    </SafeAreaProvider>,
  );
  return onSubmit;
}

beforeEach(() => jest.clearAllMocks());

it('uploads a package photo and sends its key with the new service', async () => {
  const onSubmit = await renderSheet();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Mehendi' }));
  await fireEvent.changeText(screen.getByLabelText('Service name'), 'Bridal trial');
  await fireEvent.changeText(screen.getByLabelText('Price (₹)'), '2000');
  await fireEvent.changeText(screen.getByLabelText('Duration (minutes)'), '60');

  await fireEvent.press(screen.getByRole('button', { name: 'Add a package photo' }));
  expect(await screen.findByLabelText('Package photo')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Send for review' }));

  expect(uploadImage).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file://package.jpg' }), 'service');
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ photo_key: 'artists/u1/service/abc' })));
});

it('editing keeps the photo unless it is removed', async () => {
  const unchanged = await renderSheet(withPhoto);
  expect(screen.getByLabelText('Package photo')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Send for review' }));
  await waitFor(() => expect(unchanged).toHaveBeenCalled());
  expect(unchanged.mock.calls[0][0]).not.toHaveProperty('photo_key');
});

it('removing the photo sends it as null', async () => {
  const onSubmit = await renderSheet(withPhoto);

  await fireEvent.press(screen.getByRole('button', { name: 'Remove package photo' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Send for review' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ photo_key: null })));
  expect(screen.queryByLabelText('Package photo')).toBeNull();
});
