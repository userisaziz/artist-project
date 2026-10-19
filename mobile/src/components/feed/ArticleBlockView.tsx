import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import type { ArticleBlock } from '../../utils/feed/article';

/** One block of an article: a paragraph, a `## ` heading, or a `> ` pull quote. */
export function ArticleBlockView({ block }: { block: ArticleBlock }) {
  const theme = useTheme();
  if (block.kind === 'heading') {
    return <AppText variant="title" accessibilityRole="header" style={{ color: theme.colors.heading, marginTop: 8 }}>{block.text}</AppText>;
  }
  if (block.kind === 'quote') {
    return (
      <View style={{ borderLeftWidth: 3, borderLeftColor: theme.colors.brand, paddingLeft: 12, paddingVertical: 4 }}>
        <AppText variant="accent" style={{ fontSize: 20, lineHeight: 26, color: theme.colors.brand }}>{`“${block.text}”`}</AppText>
      </View>
    );
  }
  return <AppText variant="body" style={{ fontSize: 15, lineHeight: 24, color: theme.colors.textPrimary }}>{block.text}</AppText>;
}
