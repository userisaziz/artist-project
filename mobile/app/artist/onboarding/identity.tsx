import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../../src/components/common/FormScreen';
import { AppText } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { AppTextField } from '../../../src/components/common/AppTextField';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useArtistProfile, useArtistWrite } from '../../../src/hooks/artist-onboarding/artist-onboarding';
import { pickImages, uploadImage } from '../../../src/api/artist-onboarding/upload';
import { formatAadhaar, isValidAadhaar } from '../../../src/utils/artist-onboarding/aadhaar';
import * as artistApi from '../../../src/api/artist-onboarding/artist-onboarding';
import type { KycInput } from '../../../src/types/artist-onboarding/artist-onboarding';
import { errorMessage } from '../../../src/core/api/error-message';

const INVALID = 'That doesn’t look like a valid Aadhaar number.';

/** One side of the card: the local preview and, once uploaded, its private storage key. */
interface Side { uri: string | null; key: string | null; uploading: boolean }
type SideName = 'front' | 'back';
const EMPTY: Record<SideName, Side> = {
  front: { uri: null, key: null, uploading: false },
  back: { uri: null, key: null, uploading: false },
};

// Step 4 of 4 (spec §2.2; not drawn in the design): Aadhaar number and both sides of the card, then Submit for review.
// The server never sends the number or the photos back, so details on file show only the last 4 digits.
export default function IdentityStep() {
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useArtistProfile();
  const write = useArtistWrite();
  const [replacing, setReplacing] = useState(false);
  const [digits, setDigits] = useState('');
  const [checked, setChecked] = useState(false); // validate on blur and on submit, not while typing
  const [sides, setSides] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = replacing ? null : profile?.kyc ?? null;
  const valid = isValidAadhaar(digits);
  const { front, back } = sides;
  // A key is only set once its upload finished, so both keys mean nothing is still uploading.
  const details: KycInput | null = !onFile && valid && front.key && back.key
    ? { aadhaar_number: digits, front_key: front.key, back_key: back.key }
    : null;
  const ready = !!onFile || !!details;

  const choose = async (name: SideName) => {
    const previous = sides[name];
    setError(null);
    try {
      const [image] = await pickImages(1);
      if (!image) return;
      setSides((s) => ({ ...s, [name]: { uri: image.uri, key: null, uploading: true } }));
      const { key } = await uploadImage(image, 'aadhaar');
      setSides((s) => ({ ...s, [name]: { uri: image.uri, key, uploading: false } }));
    } catch (e) {
      setSides((s) => ({ ...s, [name]: previous })); // a failed retake keeps the photo already uploaded
      setError(errorMessage(e));
    }
  };

  const replace = () => { // spec §2.2: an empty form; the number and both photos are required again
    setDigits('');
    setSides(EMPTY);
    setChecked(false);
    setError(null);
    setReplacing(true);
  };

  const submit = async () => {
    if (!onFile) setChecked(true);
    if (!ready || submitting) return; // disabled buttons still reach onPress under RNTL
    setSubmitting(true);
    setError(null);
    try {
      if (details) {
        await write(() => artistApi.saveKyc(details));
        setReplacing(false); // now on file, so a failed submit retries without re-sending the details
      }
      await write(artistApi.submitProfile); // status → pending; the artist layout moves to In review
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormScreen
      onBack={() => router.dismissTo('/artist/onboarding/portfolio')}
      step={4}
      steps={4}
      footer={<AppButton label="Submit for review" onPress={() => { void submit(); }} loading={submitting} disabled={!ready} />}
    >
      <FormHeading eyebrow="STEP 4 · IDENTITY" title="Confirm it’s" accent="you" subtitle="We use your Aadhaar only to verify your identity." />
      {onFile ? (
        <View style={{ marginTop: 20, padding: 14, gap: 8, borderRadius: theme.radii.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator }}>
          <AppText variant="label" style={{ fontSize: 15, color: theme.colors.textPrimary }}>{`Aadhaar on file •••• ${onFile.aadhaar_last4}`}</AppText>
          <Pressable accessibilityRole="button" onPress={replace} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
            <AppText variant="label" style={{ color: theme.colors.brand }}>Replace details</AppText>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={{ marginTop: 20 }}>
            <AppTextField
              label="Aadhaar number"
              value={formatAadhaar(digits)}
              onChangeText={(t) => setDigits(t.replace(/\D/g, '').slice(0, 12))}
              onBlur={() => setChecked(true)}
              keyboardType="number-pad"
              maxLength={14}
              placeholder="1234 5678 9012"
              error={checked && !valid ? INVALID : null}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <CardSide title="Front" side={front} onPress={() => { void choose('front'); }} />
            <CardSide title="Back" side={back} onPress={() => { void choose('back'); }} />
          </View>
        </>
      )}
      <View style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: theme.colors.washTop }}>
        <AppText variant="caption" style={{ color: theme.colors.textSecondary, lineHeight: 19 }}>
          Your Aadhaar is encrypted and only seen by our verification team.
        </AppText>
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
    </FormScreen>
  );
}

/** Front or back tile: tap to pick and upload, a spinner while uploading, then the local preview with "Retake". */
function CardSide({ title, side, onPress }: { title: 'Front' | 'Back'; side: Side; onPress: () => void }) {
  const theme = useTheme();
  const name = `${title.toLowerCase()} of card`;
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={side.uploading ? `Uploading ${name}` : side.key ? `Retake ${name}` : `Add ${name}`}
        disabled={side.uploading}
        onPress={onPress}
        style={{
          aspectRatio: 1.58, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
          borderWidth: 1.5, borderStyle: side.uri ? 'solid' : 'dashed', borderColor: theme.colors.border,
          backgroundColor: side.uri ? theme.colors.imageFallback : theme.colors.washTop,
        }}
      >
        {side.uri ? (
          <Image source={{ uri: side.uri }} contentFit="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: side.uploading ? 0.5 : 1 }} />
        ) : (
          <AppText style={{ fontSize: 22, color: theme.colors.brand }}>+</AppText>
        )}
        {side.uploading ? <ActivityIndicator color={theme.colors.brand} /> : null}
      </Pressable>
      <AppText variant="label" style={{ fontSize: 13, color: theme.colors.textSecondary }}>
        {title}
        {side.key ? <AppText variant="label" style={{ fontSize: 13, color: theme.colors.brand }}> · Retake</AppText> : null}
      </AppText>
    </View>
  );
}
