import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';

interface StorefrontSectionProps {
  title: string;
  /** Small text across from the title, e.g. "2 packages". */
  aside?: string;
  sectionKey: string;
  /** Reports where the section starts, so the tabs can jump to it. */
  onMeasure: (sectionKey: string, y: number) => void;
  children: ReactNode;
}

/** One titled block of the storefront page. */
export function StorefrontSection({ title, aside, sectionKey, onMeasure, children }: StorefrontSectionProps) {
  const theme = useTheme();
  return (
    <View onLayout={(event) => onMeasure(sectionKey, event.nativeEvent.layout.y)} style={{ paddingHorizontal: theme.spacing.md, paddingTop: 26, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <AppText variant="title" accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28, color: theme.colors.heading }}>{title}</AppText>
        {aside ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{aside}</AppText> : null}
      </View>
      {children}
    </View>
  );
}
