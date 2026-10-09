// Font names match the @expo-google-fonts exports loaded in Task 7.
export const fontFamilies = {
  serifSemiBold: 'CormorantGaramond_600SemiBold',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansRegular: 'PlusJakartaSans_400Regular',
} as const;

export const typographyTokens = {
  display:  { fontFamily: fontFamilies.serifSemiBold, fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
  title:    { fontFamily: fontFamilies.serifSemiBold, fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamilies.sansSemiBold,  fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  body:     { fontFamily: fontFamilies.sansRegular,   fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  caption:  { fontFamily: fontFamilies.sansMedium,    fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  button:   { fontFamily: fontFamilies.sansSemiBold,  fontSize: 16, lineHeight: 24, letterSpacing: 0.3 },
} as const;
