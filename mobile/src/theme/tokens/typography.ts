// Font names match the @expo-google-fonts exports loaded in Task 7.
export const fontFamilies = {
  serifSemiBold: 'CormorantGaramond_600SemiBold',
  serifItalic: 'CormorantGaramond_600SemiBold_Italic',
  serifItalicLight: 'CormorantGaramond_500Medium_Italic',
  sansBold: 'PlusJakartaSans_700Bold',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansRegular: 'PlusJakartaSans_400Regular',
} as const;

export const typographyTokens = {
  hero:     { fontFamily: fontFamilies.serifSemiBold, fontSize: 48, lineHeight: 47, letterSpacing: 0 },
  eyebrow:  { fontFamily: fontFamilies.sansBold,      fontSize: 11, lineHeight: 14, letterSpacing: 2 },
  display:  { fontFamily: fontFamilies.serifSemiBold, fontSize: 42, lineHeight: 44, letterSpacing: 0 },
  accent:   { fontFamily: fontFamilies.serifItalic,   fontSize: 42, lineHeight: 44, letterSpacing: 0 },
  accentLight: { fontFamily: fontFamilies.serifItalicLight, fontSize: 42, lineHeight: 44, letterSpacing: 0 },
  title:    { fontFamily: fontFamilies.serifSemiBold, fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamilies.sansSemiBold,  fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  body:     { fontFamily: fontFamilies.sansRegular,   fontSize: 14, lineHeight: 21, letterSpacing: 0 },
  label:    { fontFamily: fontFamilies.sansSemiBold,  fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  caption:  { fontFamily: fontFamilies.sansRegular,   fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  button:   { fontFamily: fontFamilies.sansSemiBold,  fontSize: 15, lineHeight: 20, letterSpacing: 0 },
} as const;
