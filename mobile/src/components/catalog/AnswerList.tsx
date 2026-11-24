import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { InfoRow } from '../common/InfoRow';
import { useTheme } from '../../core/theme/theme-provider';
import { formatAnswer } from '../../utils/catalog/fields';
import type { FieldAnswer } from '../../types/catalog/catalog';

/** Labelled answers (a service's details, or what a customer told the artist), one row each. Nothing when empty. */
export function AnswerList({ title, answers }: { title: string; answers: FieldAnswer[] }) {
  const theme = useTheme();
  if (!answers.length) return null;
  return (
    <View accessibilityLabel={title}>
      <AppText variant="subtitle" style={{ color: theme.colors.textPrimary, marginBottom: theme.spacing[1] }}>{title}</AppText>
      {answers.map((a) => <InfoRow key={a.key} label={a.label} value={formatAnswer(a)} />)}
    </View>
  );
}
