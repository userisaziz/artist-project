import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { CustomServiceSheet } from '../../components/artist-services/CustomServiceSheet';
import type { CatalogCategory } from '../../types/catalog/catalog';

const tree: CatalogCategory[] = [
  { id: 1, slug: 'mehendi', name: 'Mehendi', subcategories: [{ id: 101, slug: 'mehendi-bridal', name: 'Bridal', services: [] }] },
  { id: 2, slug: 'photography', name: 'Photography', subcategories: [] },
];

const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

async function renderSheet(onSubmit = jest.fn(async () => {})) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider><CustomServiceSheet categories={tree} onClose={jest.fn()} onSubmit={onSubmit} /></ThemeProvider>
    </SafeAreaProvider>,
  );
  return onSubmit;
}

async function fillService() {
  await fireEvent.changeText(screen.getByLabelText('Service name'), 'Couple portrait session');
  await fireEvent.changeText(screen.getByLabelText('Price (₹)'), '4000');
  await fireEvent.changeText(screen.getByLabelText('Duration (minutes)'), '120');
}

it('suggests a new subcategory under the picked category instead of an existing one', async () => {
  const onSubmit = await renderSheet();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Mehendi' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: '+ Suggest a new one' }));
  expect(screen.getByText(/Only you see it until we add it to the catalog/)).toBeTruthy();

  await fillService();
  await fireEvent.press(screen.getByRole('button', { name: 'Send for review' }));
  expect(await screen.findByText('Name the subcategory you’d like us to add.')).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('New subcategory'), ' Couple portrait ');
  await fireEvent.press(screen.getByRole('button', { name: 'Send for review' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
    suggested_subcategory: { parent_id: 1, name: 'Couple portrait' },
    name: 'Couple portrait session', price_paise: 400000, duration_minutes: 120, description: null,
    included_items: [], addons: [],
  }));
});

it('a category with no subcategories yet goes straight to suggesting one', async () => {
  await renderSheet();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Photography' }));
  expect(screen.getByLabelText('New subcategory')).toBeTruthy();
});
