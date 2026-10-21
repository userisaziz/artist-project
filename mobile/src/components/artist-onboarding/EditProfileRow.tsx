import { Alert } from 'react-native';
import { MenuRow } from '../common/MenuRow';
import { useArtistFlow } from '../../context/artist-onboarding/flow-context';
import { useReopenProfile } from '../../hooks/artist-onboarding/artist-onboarding';
import { errorMessage } from '../../core/api/error-message';

/**
 * Me → Edit profile for an approved artist. Editing sends the profile back to review, so it asks first; on success the
 * profile is a draft again and the artist layout moves to the onboarding steps, starting at Profile.
 */
export function EditProfileRow() {
  const { startEditing } = useArtistFlow();
  const reopen = useReopenProfile();

  const confirm = () =>
    Alert.alert(
      'Edit your profile?',
      'Clients can’t see or book you until we review the changes again. Your existing bookings stay as they are.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Edit profile',
          onPress: () => {
            startEditing(); // before the status flips, so the layout opens Profile rather than the last step
            reopen.mutate(undefined, { onError: (e) => Alert.alert('Couldn’t open your profile', errorMessage(e)) });
          },
        },
      ],
    );

  return <MenuRow label="Edit profile" detail={reopen.isPending ? 'Opening…' : undefined} onPress={confirm} />;
}
