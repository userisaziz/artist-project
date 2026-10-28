import { Alert } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';
import { useReportPost } from '../../hooks/feed/feed';
import type { ReportReason } from '../../types/feed/feed';

/** "Report": asks why (spam or inappropriate), sends it to the moderators, and says so. */
export function ReportPostButton({ postId }: { postId: string }) {
  const theme = useTheme();
  const report = useReportPost();
  const send = (reason: ReportReason) =>
    report.mutate(
      { id: postId, reason },
      {
        onSuccess: () => Alert.alert('Thanks for telling us', 'Our team will take a look.'),
        onError: (e) => Alert.alert('Couldn’t send the report', errorMessage(e)),
      },
    );
  const ask = () =>
    Alert.alert('Report this post?', 'Tell our team what’s wrong.', [
      { text: 'Spam', onPress: () => send('spam') },
      { text: 'Inappropriate', onPress: () => send('inappropriate') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  return (
    <PressableFeedback accessibilityRole="button" accessibilityLabel="Report this post" hitSlop={8} disabled={report.isPending} onPress={ask}>
      <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Report</AppText>
    </PressableFeedback>
  );
}
