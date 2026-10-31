import { View } from 'react-native';
import { AppTextField } from '../common/AppTextField';
import { LanguageField } from './LanguageField';
import { useTheme } from '../../core/theme/theme-provider';
import { LANGUAGES } from '../../utils/artist-onboarding/profile-details';

interface ProfileDetailsFieldsProps {
  /** The years-of-experience text as typed; the Profile step parses it on save. */
  experience: string;
  onExperienceChange: (text: string) => void;
  /** Picked languages, in the order the artist picked them. */
  languages: string[];
  onLanguagesChange: (languages: string[]) => void;
}

/** Profile step: years of experience and the languages the artist speaks, both shown on their storefront. */
export function ProfileDetailsFields({ experience, onExperienceChange, languages, onLanguagesChange }: ProfileDetailsFieldsProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
      <AppTextField
        label="Years of experience"
        value={experience}
        onChangeText={onExperienceChange}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="e.g. 8 (optional)"
      />
      <LanguageField
        label="Languages you speak (optional)"
        languages={languages}
        options={LANGUAGES}
        onChange={onLanguagesChange}
      />
    </View>
  );
}
