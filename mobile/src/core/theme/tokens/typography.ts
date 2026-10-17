// Font names match the @expo-google-fonts exports loaded in Task 7.
export const fontFamilies = {
  headingSemiBold: 'PlusJakartaSans_600SemiBold',
  headingItalic: 'PlusJakartaSans_600SemiBold_Italic',
  headingItalicLight: 'PlusJakartaSans_500Medium_Italic',
  sansBold: 'PlusJakartaSans_700Bold',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansRegular: 'PlusJakartaSans_400Regular',
} as const;

export const typographyTokens = {
  // Headings follow the prototype's "Plus Jakarta Sans" heading option: Cormorant sizes x0.78, tracking -0.025em.
  hero:     { fontFamily: fontFamilies.headingSemiBold, fontSize: 37.4, lineHeight: 36.7, letterSpacing: -0.94 },
  eyebrow:  { fontFamily: fontFamilies.sansBold,      fontSize: 11, lineHeight: 14, letterSpacing: 2 },
  display:  { fontFamily: fontFamilies.headingSemiBold, fontSize: 32.8, lineHeight: 34.3, letterSpacing: -0.82 },
  accent:   { fontFamily: fontFamilies.headingItalic,   fontSize: 32.8, lineHeight: 34.3, letterSpacing: -0.82 },
  accentLight: { fontFamily: fontFamilies.headingItalicLight, fontSize: 32.8, lineHeight: 34.3, letterSpacing: -0.82 },
  title:    { fontFamily: fontFamilies.headingSemiBold, fontSize: 17.2, lineHeight: 23.4, letterSpacing: -0.43 },
  subtitle: { fontFamily: fontFamilies.sansSemiBold,  fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  body:     { fontFamily: fontFamilies.sansRegular,   fontSize: 14, lineHeight: 21, letterSpacing: 0 },
  label:    { fontFamily: fontFamilies.sansSemiBold,  fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  caption:  { fontFamily: fontFamilies.sansRegular,   fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  button:   { fontFamily: fontFamilies.sansSemiBold,  fontSize: 15, lineHeight: 20, letterSpacing: 0 },
} as const;
