import { Pressable, type PressableProps } from 'react-native';

type TabBarButtonProps = PressableProps & { href?: string; ref?: unknown };

/** The bottom tab bar's button, announced as a button. The navigator also passes a web `href` and a ref typed for its
 *  own element; neither applies to a native Pressable, so both are dropped. */
export function TabBarButton({ href: _href, ref: _ref, ...props }: TabBarButtonProps) {
  return <Pressable {...props} accessibilityRole="button" />;
}
