import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../src/components/common/AppText';
import { Avatar } from '../../../src/components/common/Avatar';
import { formatPhone } from '../../../src/components/common/PhoneInput';
import { MenuRow } from '../../../src/components/common/MenuRow';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useAuth } from '../../../src/context/auth/auth-provider';
import { errorMessage } from '../../../src/core/api/error-message';

// Spec §2 Profile tab: name and phone, My bookings, My orders, Messages, Help & support, the artist side (PUT /users/me/role), Log out.
export default function CustomerProfile() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, chooseRole, signOut } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'You';
  const isArtist = !!user?.roles.includes('artist');

  const switchSide = async () => {
    if (switching) return;
    setSwitching(true);
    setError(null);
    try {
      await chooseRole('artist'); // the root gate moves to the artist area
    } catch (e) {
      setError(errorMessage(e));
      setSwitching(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingTop: insets.top + theme.spacing.lg, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xl }}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Avatar uri={user?.avatar_url} name={name} size={84} />
        <AppText variant="display" style={{ fontSize: 26, lineHeight: 30, color: theme.colors.heading, marginTop: 6 }}>{name}</AppText>
        <AppText variant="body" style={{ color: theme.colors.textMuted }}>{user ? formatPhone(user.phone) : ''}</AppText>
      </View>

      <View style={{ marginTop: 24, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.separator, paddingHorizontal: 14 }}>
        <MenuRow label="My bookings" onPress={() => router.navigate('/customer/bookings')} />
        <MenuRow label="My orders" onPress={() => router.push('/customer/shop/orders')} />
        <MenuRow label="Messages" onPress={() => router.push('/customer/messages')} />
        <MenuRow label="Help & support" onPress={() => router.push('/customer/support')} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => { void switchSide(); }}
        disabled={switching}
        style={{ marginTop: 14, borderRadius: 18, backgroundColor: theme.colors.brandSoft, padding: 16, flexDirection: 'row', alignItems: 'center', opacity: switching ? 0.6 : 1 }}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="subtitle" style={{ fontSize: 14.5, color: theme.colors.textPrimary }}>{isArtist ? 'Switch to artist' : 'Become an artist'}</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>{isArtist ? 'Manage your bookings with the same account' : 'Offer your services on Atelier'}</AppText>
        </View>
        <AppText style={{ color: theme.colors.brand, fontSize: 18 }}>⇄</AppText>
      </Pressable>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: 8 }}>{error}</AppText> : null}

      <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} style={{ marginTop: 24, alignSelf: 'center', padding: 12 }}>
        <AppText variant="button" style={{ color: theme.colors.brand }}>Log out</AppText>
      </Pressable>
    </ScrollView>
  );
}
