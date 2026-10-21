import { Alert, Pressable } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';
import { useDeleteAccount } from '../../hooks/auth/auth';
import { errorMessage } from '../../core/api/error-message';

/** Profile / Me → Delete account: one destructive confirm, then the server anonymises the account and the app signs out. */
export function DeleteAccountButton() {
  const theme = useTheme();
  const remove = useDeleteAccount();

  const confirm = () =>
    Alert.alert(
      'Delete your account?',
      'This can’t be undone. Your upcoming bookings and open orders are cancelled, any artist profile, photos and shop are removed, and your name and number are erased. Past bookings stay with the other person as “Deleted user”.',
      [
        { text: 'Keep account', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => remove.mutate(undefined, { onError: (e) => Alert.alert('Couldn’t delete your account', errorMessage(e)) }),
        },
      ],
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: remove.isPending }}
      disabled={remove.isPending}
      onPress={confirm}
      style={{ alignSelf: 'center', padding: 12 }}
    >
      <AppText variant="label" style={{ color: theme.colors.error }}>{remove.isPending ? 'Deleting…' : 'Delete account'}</AppText>
    </Pressable>
  );
}
