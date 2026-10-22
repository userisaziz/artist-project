import { View, type ColorValue } from 'react-native';
import {
  ArrowLeftRight,
  BadgeCheck,
  Bell,
  Bookmark,
  Brush,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flower2,
  Hand,
  Heart,
  MapPin,
  MessageCircle,
  Minus,
  Music,
  PenTool,
  Plus,
  Quote,
  Scissors,
  Search,
  Sparkles,
  Star,
  Video,
  X,
} from 'lucide-react-native';
import { useTheme } from '../../core/theme/theme-provider';

// The app's icons (lucide), behind one design-system component so features never import the library.
const ICONS = {
  'arrow-left-right': ArrowLeftRight,
  bell: Bell,
  bookmark: Bookmark,
  brush: Brush,
  camera: Camera,
  chat: MessageCircle,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  close: X,
  flower: Flower2,
  hand: Hand,
  heart: Heart,
  'map-pin': MapPin,
  minus: Minus,
  music: Music,
  'pen-tool': PenTool,
  plus: Plus,
  quote: Quote,
  scissors: Scissors,
  search: Search,
  sparkles: Sparkles,
  star: Star,
  verified: BadgeCheck,
  video: Video,
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  /** Filled glyph (a liked heart, a rating star). */
  filled?: boolean;
  /** Read by screen readers; omit for decorative icons next to text that already says it. */
  label?: string;
}

const DEFAULT_SIZE = 18;
const STROKE = 1.8;

export function Icon({ name, size = DEFAULT_SIZE, color, filled = false, label }: IconProps) {
  const theme = useTheme();
  const Glyph = ICONS[name];
  const ink = color ?? theme.colors.textPrimary;
  return (
    <View
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    >
      <Glyph size={size} color={ink as string} strokeWidth={STROKE} fill={filled ? (ink as string) : 'none'} />
    </View>
  );
}
