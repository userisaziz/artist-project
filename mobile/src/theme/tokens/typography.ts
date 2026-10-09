// Font names match the @expo-google-fonts exports loaded in Task 7.
export const fontFamilies = {
  serifBold: 'PlayfairDisplay_700Bold',
  sansSemiBold: 'Inter_600SemiBold',
  sansMedium: 'Inter_500Medium',
  sansRegular: 'Inter_400Regular',
} as const;

export const typographyTokens = {
  display:  { fontFamily: fontFamilies.serifBold,    fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
  title:    { fontFamily: fontFamilies.serifBold,    fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamilies.sansSemiBold, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  body:     { fontFamily: fontFamilies.sansRegular,  fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  caption:  { fontFamily: fontFamilies.sansMedium,   fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  button:   { fontFamily: fontFamilies.sansSemiBold, fontSize: 16, lineHeight: 24, letterSpacing: 0.3 },
} as const;
