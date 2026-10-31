import { useEffect, useState } from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import { PressableFeedback } from '../common/PressableFeedback';
import { Crossfade } from '../common/Crossfade';
import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';
import { useReducedMotion } from '../../core/motion/motion';
import { useTheme } from '../../core/theme/theme-provider';

export interface HeroSlide {
  eyebrow: string;
  title: string;
  image: ImageSourcePropType;
  /** The category the slide is about; opening it filters Explore to that category. */
  categorySlug?: string;
}

interface HomeHeroProps {
  slides: HeroSlide[];
  onOpen: (slide: HeroSlide) => void;
}

const PHOTO_HEIGHT = 250;
const CARD_OVERLAP = 36;
const CARD_RADIUS = 18;
const SLIDE_MS = 5000;
const FADE_MS = 900;
const DOT = 6;
const DOT_ACTIVE = 18;
const CHEVRON = 40;

/** The design's Home hero: full-width photos that cross-fade, under a white card with the slide's title and dots. */
export function HomeHero({ slides, onOpen }: HomeHeroProps) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  // The hero owns the clock, not a listener: one motion source for the fade and the auto-advance,
  // so they can never disagree about whether motion is welcome.
  const reduceMotion = useReducedMotion();
  const slide = slides[index];

  // Auto-advance; a tapped dot restarts the clock. Reduced motion keeps the slide until a dot is tapped.
  useEffect(() => {
    if (reduceMotion || slides.length < 2) return undefined;
    const id = setTimeout(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, reduceMotion, slides.length]);

  return (
    <View>
      <View style={{ height: PHOTO_HEIGHT, overflow: 'hidden', backgroundColor: theme.colors.washBottom }}>
        {slides.map((s, i) => (
          <Crossfade key={s.eyebrow} visible={i === index} durationMs={FADE_MS}>
            <Image source={s.image} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
          </Crossfade>
        ))}
      </View>
      {/* A row of separate controls, not one button around the dots: buttons can't nest. */}
      <View
        style={{
          marginTop: -CARD_OVERLAP, marginHorizontal: theme.spacing.md, paddingVertical: 12, paddingLeft: 16, paddingRight: 12,
          borderRadius: CARD_RADIUS, backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12,
          shadowColor: theme.colors.brand, shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 4,
        }}
      >
        <PressableFeedback accessibilityRole="button" accessibilityLabel={`${slide.title}. Explore artists`} onPress={() => onOpen(slide)} style={{ flex: 1 }}>
          <AppText variant="eyebrow" style={{ fontSize: 10.5, letterSpacing: 1.5, color: theme.colors.brand }}>{slide.eyebrow}</AppText>
          <AppText variant="title" numberOfLines={1} style={{ lineHeight: 19, color: theme.colors.textPrimary, marginTop: 2 }}>{slide.title}</AppText>
        </PressableFeedback>
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          {slides.map((s, i) => (
            <PressableFeedback
              key={s.eyebrow}
              accessibilityRole="button"
              accessibilityLabel={`Slide ${i + 1} of ${slides.length}`}
              accessibilityState={{ selected: i === index }}
              onPress={() => setIndex(i)}
              hitSlop={10}
              style={{ height: DOT, width: i === index ? DOT_ACTIVE : DOT, borderRadius: DOT / 2, backgroundColor: i === index ? theme.colors.brand : theme.colors.indicatorInactive }}
            />
          ))}
        </View>
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel={`Open ${slide.title}`}
          onPress={() => onOpen(slide)}
          style={{ width: CHEVRON, height: CHEVRON, borderRadius: CHEVRON / 2, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="chevron-right" size={20} color={theme.colors.textOnBrand} />
        </PressableFeedback>
      </View>
    </View>
  );
}
