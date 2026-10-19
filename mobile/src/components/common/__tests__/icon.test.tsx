import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../core/theme/theme-provider';
import { Icon } from '../Icon';

it('renders a labelled icon for screen readers and hides decorative ones', async () => {
  await render(<ThemeProvider><Icon name="heart" filled label="Liked" /><Icon name="search" /></ThemeProvider>);

  expect(screen.getByLabelText('Liked')).toBeTruthy();
  expect(screen.queryAllByLabelText(/./)).toHaveLength(1);
});
