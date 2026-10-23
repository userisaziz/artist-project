import { Pressable, View } from 'react-native';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

interface ShopBannerProps {
  onPress: () => void;
}

const HEIGHT = 150;
const BUTTON_RADIUS = 10;

/** Home's "New · Atelier Shop" banner: points customers at the shop. */
export function ShopBanner({ onPress }: ShopBannerProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open the Atelier Shop"
      onPress={onPress}
      style={{ height: HEIGHT, borderRadius: theme.radii.card, backgroundColor: theme.colors.brandSoft, paddingHorizontal: 16, paddingTop: 18, overflow: 'hidden' }}
    >
      <AppText variant="eyebrow" style={{ fontSize: 10.5, letterSpacing: 1.5, color: theme.colors.brand }}>NEW · ATELIER SHOP</AppText>
      <AppText variant="title" style={{ fontSize: 18.7, lineHeight: 20, color: theme.colors.textPrimary, marginTop: 4, maxWidth: 200 }}>
        Henna, lip kits & presets from your artists
      </AppText>
      <View style={{ alignSelf: 'flex-start', marginTop: 10, height: 32, paddingHorizontal: 12, borderRadius: BUTTON_RADIUS, backgroundColor: theme.colors.textPrimary, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <AppText variant="label" style={{ color: theme.colors.textOnBrand }}>Shop now</AppText>
        <Icon name="chevron-right" size={14} color={theme.colors.textOnBrand} />
      </View>
    </Pressable>
  );
}
