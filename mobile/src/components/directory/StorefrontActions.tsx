import { Pressable, View } from 'react-native';
import { AppButton } from '../common/AppButton';
import { Icon } from '../common/Icon';
import { useTheme } from '../../core/theme/theme-provider';

/** Following the artist: hidden until the current state is known. */
export interface FollowControl {
  following: boolean;
  pending: boolean;
  onToggle: () => void;
}

interface StorefrontActionsProps {
  businessName: string;
  onBook: () => void;
  onMessage: () => void;
  messaging: boolean;
  onEnquire: () => void;
  follow?: FollowControl;
}

const FOLLOW_SIZE = 52;

/** Book now, Message, Enquire (a custom quote) and Follow, under the stats card. */
export function StorefrontActions({ businessName, onBook, onMessage, messaging, onEnquire, follow }: StorefrontActionsProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingTop: 14 }}>
      <View style={{ flex: 1.4 }}>
        <AppButton label="Book now" onPress={onBook} />
      </View>
      <View style={{ flex: 1 }}>
        <AppButton label="Message" accessibilityLabel={`Message ${businessName}`} variant="secondary" loading={messaging} onPress={onMessage} />
      </View>
      <View style={{ flex: 1 }}>
        <AppButton label="Enquire" accessibilityLabel={`Request a quote from ${businessName}`} variant="secondary" onPress={onEnquire} />
      </View>
      {follow ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${follow.following ? 'Unfollow' : 'Follow'} ${businessName}`}
          accessibilityState={{ selected: follow.following, busy: follow.pending }}
          disabled={follow.pending}
          onPress={follow.onToggle}
          style={{
            width: FOLLOW_SIZE,
            height: FOLLOW_SIZE,
            borderRadius: FOLLOW_SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: follow.following ? theme.colors.brand : theme.colors.border,
            backgroundColor: follow.following ? theme.colors.brandSoft : theme.colors.surface,
          }}
        >
          <Icon name={follow.following ? 'check' : 'plus'} size={20} color={theme.colors.brand} />
        </Pressable>
      ) : null}
    </View>
  );
}
