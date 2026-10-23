import { useState } from 'react';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../src/components/common/FormScreen';
import { AppText } from '../../src/components/common/AppText';
import { AppButton } from '../../src/components/common/AppButton';
import { ProfileDetailsFields } from '../../src/components/artist-onboarding/ProfileDetailsFields';
import { useTheme } from '../../src/core/theme/theme-provider';
import { useArtistProfile, useUpdateDetails } from '../../src/hooks/artist-onboarding/artist-onboarding';
import { parseExperience } from '../../src/utils/artist-onboarding/profile-details';
import { errorMessage } from '../../src/core/api/error-message';

// Me > Experience & languages (a profile requirement links here): an approved artist changes them without a review.
export default function UpdateDetails() {
  const theme = useTheme();
  const router = useRouter();
  const { data: saved } = useArtistProfile();
  const update = useUpdateDetails();
  const [experience, setExperience] = useState(saved?.experience_years == null ? '' : String(saved.experience_years));
  const [languages, setLanguages] = useState<string[]>(saved?.languages ?? []);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const years = parseExperience(experience);
    if (!years.ok) { setError(years.error); return; }
    setError(null);
    try {
      await update.mutateAsync({ experience_years: years.value, languages });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <FormScreen onBack={() => router.back()} footer={<AppButton label="Save" onPress={() => { void save(); }} loading={update.isPending} />}>
      <FormHeading eyebrow="YOUR PROFILE" title="Experience &" accent="languages" subtitle="Both show on your storefront. Changing them needs no new review." />
      <ProfileDetailsFields experience={experience} onExperienceChange={setExperience} languages={languages} onLanguagesChange={setLanguages} />
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
    </FormScreen>
  );
}
