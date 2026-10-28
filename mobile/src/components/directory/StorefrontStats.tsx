import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import { formatMonthShort } from '../../utils/common/time';
import { formatReplyTime } from '../../utils/directory/storefront';
import { formatAverage, ratingLong, reviewCountLabel } from '../../utils/reviews/format';
import type { ArtistPublic } from '../../types/directory/directory';
import { STATS_OVERLAP } from './StorefrontHero';
import { brand } from '../../core/brand/brand';

interface StorefrontStatsProps {
  artist: ArtistPublic;
}

interface Stat {
  key: string;
  value: string;
  label: string;
  accessibilityLabel?: string;
  rating?: boolean;
}

function stats(artist: ArtistPublic): Stat[] {
  const rating = artist.review_count > 0 ? artist.rating : null;
  const rated = rating !== null;
  const list: Stat[] = [
    {
      key: 'rating',
      value: rating !== null ? formatAverage(rating) : 'New',
      label: reviewCountLabel(artist.review_count),
      accessibilityLabel: ratingLong(artist.rating, artist.review_count),
      rating: rated,
    },
    { key: 'bookings', value: String(artist.completed_bookings), label: 'Bookings' },
    artist.experience_years !== null
      ? { key: 'experience', value: `${artist.experience_years} ${artist.experience_years === 1 ? 'yr' : 'yrs'}`, label: 'Experience' }
      : { key: 'since', value: artist.member_since ? formatMonthShort(artist.member_since) : '—', label: `On ${brand.name} since` },
  ];
  return artist.reply_minutes === null ? list : [...list, { key: 'reply', value: formatReplyTime(artist.reply_minutes), label: 'Replies in' }];
}

/** The white card overlapping the hero: rating, completed bookings, years of experience (time on Atelier when the
 *  artist hasn't said) and, once known, reply time. */
export function StorefrontStats({ artist }: StorefrontStatsProps) {
  const theme = useTheme();
  const items = stats(artist);
  return (
    <View style={{ marginTop: -STATS_OVERLAP, marginHorizontal: theme.spacing.md, flexDirection: 'row', paddingVertical: 14, borderRadius: theme.radii.card, backgroundColor: theme.colors.surface, ...theme.shadows.sm }}>
      {items.map((s, i) => (
        <View
          key={s.key}
          accessible
          accessibilityLabel={s.accessibilityLabel ?? `${s.value} ${s.label}`}
          style={{ flex: 1, alignItems: 'center', gap: 2, borderRightWidth: i < items.length - 1 ? 1 : 0, borderRightColor: theme.colors.separator }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            {s.rating ? <Icon name="star" size={14} color={theme.colors.brand} filled /> : null}
            <AppText variant="subtitle" style={{ color: s.rating ? theme.colors.brand : theme.colors.textPrimary }}>{s.value}</AppText>
          </View>
          <AppText variant="caption" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>{s.label}</AppText>
        </View>
      ))}
    </View>
  );
}
