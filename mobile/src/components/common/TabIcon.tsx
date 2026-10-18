import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';

export type TabIconName = 'home' | 'explore' | 'bookings' | 'profile' | 'calendar' | 'messages';

/** Atelier tab bar glyphs (24px line icons from the prototype). */
export function TabIcon({ name, color }: { name: TabIconName; color: ColorValue }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  switch (name) {
    case 'home':
      return <Svg {...common}><Path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Svg>;
    case 'explore':
      return <Svg {...common}><Circle cx={11} cy={11} r={7} /><Path d="M20 20l-4-4" /></Svg>;
    case 'bookings':
      return <Svg {...common}><Path d="M9 11l3 3 8-8" /><Path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></Svg>;
    case 'calendar':
      return <Svg {...common}><Rect x={3} y={5} width={18} height={16} rx={3} /><Path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
    case 'messages':
      return <Svg {...common}><Path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" /></Svg>;
    case 'profile':
      return <Svg {...common}><Circle cx={12} cy={8} r={4} /><Path d="M4 21a8 8 0 0 1 16 0" /></Svg>;
  }
}
