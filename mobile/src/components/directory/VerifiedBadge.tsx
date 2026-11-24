import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

/** The "ID verified" tick next to an artist's name, shown only when an ID is on file (`ArtistCard.id_verified`).
 *  One glyph everywhere, so customers learn to read it. */
export function VerifiedBadge({ verified, size = 14 }: { verified: boolean; size?: number }) {
  const theme = useTheme();
  if (!verified) return null;
  return <Icon name="verified" size={size} color={theme.colors.brand} label="ID verified" />;
}
