import { View } from 'react-native';
import { StatTile } from './StatTile';
import { useTheme } from '../../core/theme/theme-provider';
import type { ArtistDashboard } from '../../types/bookings/bookings';

export type StatKey = 'requests' | 'week' | 'rating' | 'enquiries';

interface DashboardStatsProps {
  dashboard: ArtistDashboard;
  onOpen: (key: StatKey) => void;
}

/** Artist home 2×2 KPI grid: new requests, this week's bookings, rating and open enquiries. */
export function DashboardStats({ dashboard: d, onOpen }: DashboardStatsProps) {
  const theme = useTheme();
  const row = { flexDirection: 'row', gap: theme.spacing[3] } as const;
  return (
    <View style={{ gap: theme.spacing[3] }}>
      <View style={row}>
        <StatTile
          icon="bell"
          label="New requests"
          value={String(d.requests)}
          hint={d.requests_expiring_soon ? `${d.requests_expiring_soon} expiring soon` : d.requests ? 'Waiting for your answer' : 'All answered'}
          alert={d.requests_expiring_soon > 0}
          onPress={() => onOpen('requests')}
        />
        <StatTile
          icon="calendar"
          label="Next 7 days"
          value={String(d.upcoming_this_week)}
          hint={`${d.upcoming} upcoming in total`}
          onPress={() => onOpen('week')}
        />
      </View>
      <View style={row}>
        <StatTile
          icon="star"
          label="Rating"
          value={d.rating === null ? '—' : d.rating.toFixed(1)}
          hint={d.review_count ? `${d.review_count} ${d.review_count === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}
          onPress={() => onOpen('rating')}
        />
        <StatTile
          icon="inbox"
          label="Enquiries"
          value={String(d.enquiries_open)}
          hint={d.enquiries_open ? 'Awaiting your quote' : 'No open enquiries'}
          alert={d.enquiries_open > 0}
          onPress={() => onOpen('enquiries')}
        />
      </View>
    </View>
  );
}
