import { Pressable, View } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';

interface ShopBannerProps {
  onPress: () => void;
}

/** Home's "New · Atelier Shop" banner: points customers at the shop. */
export function ShopBanner({ onPress }: ShopBannerProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open the Atelier Shop"
      onPress={onPress}
      style={{ borderRadius: theme.radii.card, backgroundColor: theme.colors.brandSoft, padding: 18 }}
    >
      <AppText variant="eyebrow" style={{ color: theme.colors.brand }}>NEW · ATELIER SHOP</AppText>
      <AppText variant="display" style={{ fontSize: 22, lineHeight: 26, color: theme.colors.heading, marginTop: 4, maxWidth: 240 }}>
        Henna, lip kits and presets from your artists
      </AppText>
      <View style={{ alignSelf: 'flex-start', marginTop: 12, height: 32, paddingHorizontal: 14, borderRadius: theme.radii.pill, backgroundColor: theme.colors.brand, justifyContent: 'center' }}>
        <AppText variant="label" style={{ fontSize: 12.5, color: theme.colors.textOnBrand }}>Shop now</AppText>
      </View>
    </Pressable>
  );
}
