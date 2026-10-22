import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, View, type ImageSourcePropType } from 'react-native';
import { AppText, Accent } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

export interface HeroSlide {
  eyebrow: string;
  title: string;
  accent: string;
  image: ImageSourcePropType;
}

interface HomeHeroProps {
  slides: HeroSlide[];
  onOpen: () => void;
}

const PHOTO_HEIGHT = 250;
const CARD_OVERLAP = 36;
const SLIDE_MS = 5000;
const FADE_MS = 900;
const DOT = 6;
const DOT_ACTIVE = 18;

/** The design's Home hero: full-width photos that cross-fade, under a white card with the slide's title and dots. */
export function HomeHero({ slides, onOpen }: HomeHeroProps) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [fades] = useState(() => slides.map((_, i) => new Animated.Value(i === 0 ? 1 : 0)));
  const slide = slides[index];

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => { if (live) setReduceMotion(on); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { live = false; sub.remove(); };
  }, []);

  // Auto-advance; a tapped dot restarts the clock. Reduced motion keeps the slide until a dot is tapped.
  useEffect(() => {
    if (reduceMotion || slides.length < 2) return undefined;
    const id = setTimeout(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, reduceMotion, slides.length]);

  useEffect(() => {
    const animations = fades.map((v, i) => Animated.timing(v, { toValue: i === index ? 1 : 0, duration: reduceMotion ? 0 : FADE_MS, useNativeDriver: true }));
    Animated.parallel(animations).start();
  }, [fades, index, reduceMotion]);

  return (
    <View>
      <View style={{ height: PHOTO_HEIGHT, overflow: 'hidden', backgroundColor: theme.colors.washBottom }}>
        {slides.map((s, i) => (
          <Animated.Image key={s.eyebrow} source={s.image} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: fades[i] }} />
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${slide.title}${slide.accent}. Explore artists`}
        onPress={onOpen}
        style={{
          marginTop: -CARD_OVERLAP, marginHorizontal: theme.spacing.md, paddingVertical: 12, paddingLeft: 16, paddingRight: 12,
          borderRadius: theme.radii.card, backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12, ...theme.shadows.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.brand }}>{slide.eyebrow}</AppText>
          <AppText variant="display" style={{ fontSize: 22, lineHeight: 26, color: theme.colors.heading, marginTop: 2 }}>
            {slide.title}<Accent>{slide.accent}</Accent>
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          {slides.map((s, i) => (
            <Pressable
              key={s.eyebrow}
              accessibilityRole="button"
              accessibilityLabel={`Slide ${i + 1} of ${slides.length}`}
              accessibilityState={{ selected: i === index }}
              onPress={() => setIndex(i)}
              hitSlop={10}
              style={{ height: DOT, width: i === index ? DOT_ACTIVE : DOT, borderRadius: DOT / 2, backgroundColor: i === index ? theme.colors.brand : theme.colors.brandSoft }}
            />
          ))}
        </View>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chevron-right" size={20} color={theme.colors.textOnBrand} />
        </View>
      </Pressable>
    </View>
  );
}
