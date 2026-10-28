import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PressableFeedback } from '../../../src/components/common/PressableFeedback';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../../src/components/common/FormScreen';
import { AppText } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { AppTextField } from '../../../src/components/common/AppTextField';
import { Chip } from '../../../src/components/common/Chip';
import { CityField } from '../../../src/components/artist-onboarding/CityField';
import { ProfileDetailsFields } from '../../../src/components/artist-onboarding/ProfileDetailsFields';
import { parseExperience } from '../../../src/utils/artist-onboarding/profile-details';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useArtistProfile, useSaveProfile, useUploadPhoto } from '../../../src/hooks/artist-onboarding/artist-onboarding';
import { useCategories, useCities } from '../../../src/hooks/catalog/catalog';
import { useArtistFlow } from '../../../src/context/artist-onboarding/flow-context';
import { pickImages } from '../../../src/api/artist-onboarding/upload';
import { errorMessage } from '../../../src/core/api/error-message';

const MAX_CATEGORIES = 6; // backend ProfileIn.category_ids max_length

/** A catalog list that failed to load or came back empty: say so, and let the user retry instead of a silent dead end. */
function CatalogRetry({ message, isError, onRetry }: { message: string; isError: boolean; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ marginTop: 8, alignItems: 'flex-start', gap: 8 }}>
      <AppText variant="caption" style={{ color: isError ? theme.colors.error : theme.colors.textMuted }}>{message}</AppText>
      <AppButton label="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}

// Atelier hi-fi "onbProfile" (step 1 of 5): photo, business name, categories and city. Continue saves the draft.
export default function ProfileStep() {
  const theme = useTheme();
  const router = useRouter();
  const { data: saved } = useArtistProfile();
  const { editing } = useArtistFlow();
  const saveProfile = useSaveProfile();
  const uploadPhoto = useUploadPhoto();
  const categories = useCategories();
  const cities = useCities();

  const [photoKey, setPhotoKey] = useState(saved?.photo_key ?? null);
  const [photoUri, setPhotoUri] = useState(saved?.photo_url ?? null);
  const [name, setName] = useState(saved?.business_name ?? '');
  const [picked, setPicked] = useState<number[]>(saved?.categories.map((c) => c.id) ?? []);
  const [city, setCity] = useState(saved?.city ?? null);
  const [experience, setExperience] = useState(saved?.experience_years == null ? '' : String(saved.experience_years));
  const [languages, setLanguages] = useState<string[]>(saved?.languages ?? []);
  const [error, setError] = useState<string | null>(null);

  const choosePhoto = async () => {
    setError(null);
    try {
      const [image] = await pickImages(1);
      if (!image) return;
      setPhotoUri(image.uri);
      setPhotoKey((await uploadPhoto.mutateAsync({ image, purpose: 'artist_photo' })).key);
    } catch (e) {
      setPhotoUri(saved?.photo_url ?? null);
      setError(errorMessage(e));
    }
  };

  const toggle = (id: number) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < MAX_CATEGORIES ? [...ids, id] : ids));

  const uploading = uploadPhoto.isPending;
  const ready = !!photoKey && !!name.trim() && picked.length > 0 && !!city && !uploading;
  const save = async () => {
    if (!ready || !city) return;
    const years = parseExperience(experience);
    if (!years.ok) { setError(years.error); return; }
    setError(null);
    try {
      await saveProfile.mutateAsync({
        business_name: name.trim(), city, category_ids: picked, photo_key: photoKey,
        experience_years: years.value, languages,
      });
      router.push('/artist/onboarding/location');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <FormScreen
      // Editing a rejection starts here, so there is no Intro behind it.
      onBack={editing ? undefined : () => router.dismissTo('/artist/onboarding/intro')}
      step={1}
      steps={5}
      footer={<AppButton label="Continue" onPress={() => { void save(); }} loading={saveProfile.isPending} disabled={!ready} />}
    >
      <FormHeading eyebrow="STEP 1 · PROFILE" title="Tell clients" accent="who you are" />
      <PressableFeedback
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
      </PressableFeedback>

      <View style={{ marginTop: 20 }}>
        <AppTextField label="Business name" value={name} onChangeText={setName} maxLength={120} autoCapitalize="words" placeholder="e.g. Ayesha Mehendi Art" />
      </View>

      <AppText variant="label" style={{ color: theme.colors.textSecondary, marginTop: 16 }}>What do you offer?</AppText>
      {categories.isError || categories.data?.length === 0 ? (
        <CatalogRetry message={categories.isError ? errorMessage(categories.error) : 'No categories are available yet.'} isError={categories.isError} onRetry={() => { void categories.refetch(); }} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {(categories.data ?? []).map((c) => (
            <Chip key={c.id} label={c.name} selected={picked.includes(c.id)} onPress={() => toggle(c.id)} />
          ))}
        </View>
      )}

      <AppText variant="label" style={{ color: theme.colors.textSecondary, marginTop: 16, marginBottom: 8 }}>City</AppText>
      {cities.isError || cities.data?.length === 0 ? (
        <CatalogRetry message={cities.isError ? errorMessage(cities.error) : 'No cities are available yet.'} isError={cities.isError} onRetry={() => { void cities.refetch(); }} />
      ) : (
        <CityField value={city} cities={cities.data ?? []} onChange={setCity} />
      )}

      <ProfileDetailsFields experience={experience} onExperienceChange={setExperience} languages={languages} onLanguagesChange={setLanguages} />

      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
    </FormScreen>
  );
}
