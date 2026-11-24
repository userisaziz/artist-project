import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../core/theme/theme-provider';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { messageFixture } from '../../mocks/chat/chat';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

it('shows a photo message and opens it full screen', async () => {
  const message = messageFixture({ text: '', photo_url: 'https://fake.storage/full/design.jpg' });
  await render(<ThemeProvider><MessageBubble message={message} mine={false} author="Priya" /></ThemeProvider>);

  await fireEvent.press(screen.getByRole('imagebutton', { name: 'Priya sent a photo, open full screen' }));
  expect(screen.getByRole('button', { name: 'Close photos' })).toBeTruthy();
});

it('keeps the text of a photo with a caption', async () => {
  const message = messageFixture({ text: 'Like this one?', photo_url: 'https://fake.storage/full/design.jpg' });
  await render(<ThemeProvider><MessageBubble message={message} mine author="" /></ThemeProvider>);
  expect(screen.getByText('Like this one?')).toBeTruthy();
  expect(screen.getByLabelText(/^You: sent a photo: Like this one\?/)).toBeTruthy();
});
