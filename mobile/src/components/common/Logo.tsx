import { AppText } from './AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { brand } from '../../core/brand/brand';

/** The brand wordmark: text in the heading face until logo files land in brand/logos/. Size: typography.logo. */
export function Logo({ color }: { color?: string }) {
  const theme = useTheme();
  return <AppText variant="logo" style={{ color: color ?? theme.colors.heading }}>{brand.wordmark}</AppText>;
}
