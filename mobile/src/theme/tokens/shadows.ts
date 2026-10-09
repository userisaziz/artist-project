// Rose-tinted soft shadows: warm low-alpha ink keeps the feminine feel (gray shadows read cold).
export const shadows = {
  sm: { shadowColor: '#3A2530', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  md: { shadowColor: '#3A2530', shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  lg: { shadowColor: '#3A2530', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
} as const;
