import { Pressable, ScrollView, View } from 'react-native';
import { AppText } from '../common/AppText';
import { Icon, type IconName } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';
import type { Category } from '../../types/catalog/catalog';

interface CategoryIconRowProps {
  categories: Category[];
  onPick: (category: Category) => void;
}

const CIRCLE = 62;
const ITEM_WIDTH = 72;
// The design's service icons, matched by category slug; anything else gets the generic sparkle.
const ICON_BY_SLUG: Record<string, IconName> = {
  mehendi: 'hand', photography: 'camera', makeup: 'brush', hair: 'scissors',
  decor: 'flower', videography: 'video', tattoo: 'pen-tool', music: 'music',
};

/** Home "Services": a sideways row of round category icons; the first is filled as in the design. */
export function CategoryIconRow({ categories, onPick }: CategoryIconRowProps) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 14 }}>
      {categories.map((c, i) => {
        const lead = i === 0;
        return (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name} artists`} onPress={() => onPick(c)} style={{ width: ITEM_WIDTH, alignItems: 'center', gap: 7 }}>
            <View style={[{ width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: lead ? theme.colors.brand : theme.colors.brandSoft }, lead ? theme.shadows.sm : null]}>
              <Icon name={ICON_BY_SLUG[c.slug] ?? 'sparkles'} size={28} color={lead ? theme.colors.textOnBrand : theme.colors.brand} />
            </View>
            <AppText variant="caption" numberOfLines={1} style={{ fontSize: 11.5, fontWeight: lead ? '700' : '500', color: lead ? theme.colors.brand : theme.colors.textPrimary }}>{c.name}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
