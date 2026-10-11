import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../../src/components/FormScreen';
import { AppText } from '../../../src/components/AppText';
import { AppButton } from '../../../src/components/AppButton';
import { AppTextField } from '../../../src/components/AppTextField';
import { Chip } from '../../../src/components/Chip';
import { CityField } from '../../../src/artist/CityField';
import { useTheme } from '../../../src/theme/theme-provider';
import { useArtistProfile, useArtistWrite, useCategories, useCities } from '../../../src/artist/queries';
import { useArtistFlow } from '../../../src/artist/flow-context';
import { pickImages, uploadImage } from '../../../src/artist/upload';
import * as artistApi from '../../../src/api/endpoints/artist';
import { errorMessage } from '../../../src/api/error-message';

const MAX_CATEGORIES = 6; // backend ProfileIn.category_ids max_length

// Atelier hi-fi "onbProfile" (step 1 of 3): photo, business name, categories and city. Continue saves the draft.
export default function ProfileStep() {
  const theme = useTheme();
  const router = useRouter();
  const { data: saved } = useArtistProfile();
  const { editing } = useArtistFlow();
  const write = useArtistWrite();
  const categories = useCategories();
  const cities = useCities();

  const [photoKey, setPhotoKey] = useState(saved?.photo_key ?? null);
  const [photoUri, setPhotoUri] = useState(saved?.photo_url ?? null);
  const [name, setName] = useState(saved?.business_name ?? '');
  const [picked, setPicked] = useState<number[]>(saved?.categories.map((c) => c.id) ?? []);
  const [city, setCity] = useState(saved?.city ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choosePhoto = async () => {
    setError(null);
    try {
      const [image] = await pickImages(1);
      if (!image) return;
      setUploading(true);
      setPhotoUri(image.uri);
      setPhotoKey((await uploadImage(image, 'artist_photo')).key);
    } catch (e) {
      setPhotoUri(saved?.photo_url ?? null);
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const toggle = (id: number) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < MAX_CATEGORIES ? [...ids, id] : ids));

  const ready = !!photoKey && !!name.trim() && picked.length > 0 && !!city && !uploading;
  const save = async () => {
    if (!ready || !city) return;
    setSaving(true);
    setError(null);
    try {
      await write(() => artistApi.saveProfile({ business_name: name.trim(), city, category_ids: picked, photo_key: photoKey }));
      router.push('/artist/onboarding/services');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScreen
      // Editing a rejection starts here, so there is no Intro behind it.
      onBack={editing ? undefined : () => router.dismissTo('/artist/onboarding/intro')}
      step={1}
      steps={3}
      footer={<AppButton label="Continue" onPress={() => { void save(); }} loading={saving} disabled={!ready} />}
    >
      <FormHeading eyebrow="STEP 1 · PROFILE" title="Tell clients" accent="who you are" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={photoKey ? 'Change profile photo' : 'Add profile photo'}
        onPress={() => { void choosePhoto(); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 }}
      >
        <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.colors.border, padding: 3 }}>
          <View style={{ flex: 1, borderRadius: 38, overflow: 'hidden', backgroundColor: theme.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            {photoUri ? <Image source={{ uri: photoUri }} contentFit="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : <AppText style={{ fontSize: 22, color: theme.colors.brand }}>+</AppText>}
            {uploading ? <ActivityIndicator color={theme.colors.brand} /> : null}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="label" style={{ fontSize: 14, color: theme.colors.textPrimary }}>Profile photo</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 2 }}>A clear, smiling photo builds trust</AppText>
        </View>
      </Pressable>

      <View style={{ marginTop: 20 }}>
        <AppTextField label="Business name" value={name} onChangeText={setName} maxLength={120} autoCapitalize="words" placeholder="e.g. Ayesha Mehendi Art" />
      </View>

      <AppText variant="label" style={{ color: theme.colors.textSecondary, marginTop: 16 }}>What do you offer?</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {(categories.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} selected={picked.includes(c.id)} onPress={() => toggle(c.id)} />
        ))}
      </View>

      <AppText variant="label" style={{ color: theme.colors.textSecondary, marginTop: 16, marginBottom: 8 }}>City</AppText>
      <CityField value={city} cities={cities.data ?? []} onChange={setCity} />

      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
    </FormScreen>
  );
}
