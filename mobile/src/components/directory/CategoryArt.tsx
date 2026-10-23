import type { ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { SvgXml } from 'react-native-svg';
import { MAKEUP_FACE, MEHENDI_HAND, PHOTOGRAPHY_CAMERA } from './category-art-svg';

// The design's illustrated category icons, by category slug, at the size each one is drawn in the design.
const SVG: Record<string, { xml: string; size: number }> = {
  mehendi: { xml: MEHENDI_HAND, size: 34 },
  photography: { xml: PHOTOGRAPHY_CAMERA, size: 38 },
  makeup: { xml: MAKEUP_FACE, size: 38 },
};
const PNG: Record<string, { source: ImageSourcePropType; size: number }> = {
  hair: { source: require('../../../assets/icons/hair.png'), size: 36 },
};

export function hasCategoryArt(slug: string): boolean {
  return slug in SVG || slug in PNG;
}

/** One category's illustration in `color`; renders nothing for a category without one (callers fall back to an icon). */
export function CategoryArt({ slug, color }: { slug: string; color: string }) {
  const svg = SVG[slug];
  if (svg) return <SvgXml xml={svg.xml} color={color} width={svg.size} height={svg.size} />;
  const png = PNG[slug];
  if (png) return <Image source={png.source} tintColor={color} contentFit="contain" style={{ width: png.size, height: png.size }} />;
  return null;
}
