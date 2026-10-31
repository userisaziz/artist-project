import { ActivityIndicator, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { Skeleton } from './Skeleton';
import { placeholderExit } from '../../core/motion/motion';
import { useTheme } from '../../core/theme/theme-provider';
import { errorMessage } from '../../core/api/error-message';

/** Which silhouette a first load shows. The placeholder draws the shape of the content that is coming,
 *  so the screen has structure while it waits instead of a spinner floating in an empty page. */
export type LoadingShape = 'list' | 'tiles' | 'icons' | 'detail' | 'spinner';

interface LoadingViewProps {
  /** What the screen is waiting for. Announced once for the whole placeholder, not per block. */
  label?: string;
  shape?: LoadingShape;
  /** Rows for the `list` shape; `tiles` and `icons` fill the viewport themselves. Ignored by `spinner`. */
  count?: number;
}

const DEFAULT_ROWS = 4;
const LINE = 12;
// Deterministic width jitter: a stamp of identical rows reads as a broken image, not as content arriving.
const PRIMARY_WIDTHS = ['72%', '58%', '66%', '48%', '62%', '54%'] as const;
const SECONDARY_WIDTHS = ['44%', '32%', '38%', '26%', '36%', '30%'] as const;

/** How many `item`-wide blocks of a sideways row fit between `pad` insets, `gap` apart. */
function fitCount(item: number, gap: number, viewport: number, pad: number): number {
  return Math.max(2, Math.floor((viewport - pad * 2 + gap) / (item + gap)));
}

/** Rows of the directory / bookings / inbox shape: a round cover, a title, a muted line. */
function ListRows({ count }: { count: number }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Skeleton height={44} width={44} radius={22} tone="image" />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton height={LINE} width={PRIMARY_WIDTHS[i % PRIMARY_WIDTHS.length]} radius={theme.radii.xs} />
            <Skeleton height={LINE} width={SECONDARY_WIDTHS[i % SECONDARY_WIDTHS.length]} radius={theme.radii.xs} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Home's sideways tiles: a tall cover with two caption lines under it, ending at the screen edge like the
 *  real row. */
function TileRows() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const count = fitCount(172, 12, width, theme.spacing.md);
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: 172, gap: 9 }}>
          <Skeleton height={214} width={172} radius={theme.radii.lg} tone="image" />
          <Skeleton height={LINE} width={PRIMARY_WIDTHS[i % PRIMARY_WIDTHS.length]} radius={theme.radii.xs} />
          <Skeleton height={LINE} width={SECONDARY_WIDTHS[i % SECONDARY_WIDTHS.length]} radius={theme.radii.xs} />
        </View>
      ))}
    </View>
  );
}

/** The Services strip: a round icon with a label under it, at the CategoryIconRow's own pitch. */
function IconRows() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const count = fitCount(72, 14, width, theme.spacing.md);
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: 72, alignItems: 'center', gap: 7 }}>
          <Skeleton height={62} width={62} radius={31} />
          <Skeleton height={10} width={i % 2 ? '70%' : '90%'} radius={theme.radii.xs} />
        </View>
      ))}
    </View>
  );
}

/** A detail route: a cover that fills the width, its title, then one card of body. */
function DetailRows() {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <Skeleton height={206} width={'100%'} radius={theme.radii.card} tone="image" />
      <Skeleton height={18} width="58%" radius={theme.radii.xs} />
      <Skeleton height={LINE} width="40%" radius={theme.radii.xs} />
      <Skeleton height={104} width={'100%'} radius={theme.radii.card} style={{ marginTop: theme.spacing.sm }} />
    </View>
  );
}

/**
 * The first-load placeholder. `spinner` is the one exception — it stays a bare spinner for a footer that
 * is appending to content already on screen, where a second block of placeholders would read as new data.
 */
export function LoadingView({ label = 'Loading', shape = 'list', count = DEFAULT_ROWS }: LoadingViewProps) {
  const theme = useTheme();
  if (shape === 'spinner') {
    return (
      <View accessibilityLabel={label} style={{ paddingVertical: theme.spacing.md, alignItems: 'center' }}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }
  const rows =
    shape === 'tiles' ? <TileRows />
      : shape === 'icons' ? <IconRows />
        : shape === 'detail' ? <DetailRows />
          : <ListRows count={count} />;
  return (
    // `accessible` folds the blocks into one announcement, so a screen reader says "Loading your orders"
    // once instead of once per skeleton. exiting fades the whole placeholder out as the content lands.
    <Animated.View exiting={placeholderExit} accessible accessibilityLabel={label} style={{ paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.md }}>
      {rows}
    </Animated.View>
  );
}

/** A failed load: the server's message (or the generic one) with Try again. */
export function ErrorView({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: theme.spacing.lg, gap: theme.spacing.md }}>
      <AppText variant="body" style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>{errorMessage(error)}</AppText>
      <AppButton label="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}

export function EmptyView({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: theme.spacing.xl, paddingHorizontal: theme.spacing.md, borderRadius: theme.radii.card, backgroundColor: theme.colors.canvas }}>
      <AppText variant="body" style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>{message}</AppText>
    </View>
  );
}
