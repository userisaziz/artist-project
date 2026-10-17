// Rose-tinted soft shadows, as in the prototype (rgba(182,77,117,…)); gray shadows read cold.
export const shadows = {
  sm: { shadowColor: '#B64D75', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  md: { shadowColor: '#B64D75', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  lg: { shadowColor: '#B64D75', shadowOpacity: 0.25, shadowRadius: 40, shadowOffset: { width: 0, height: 20 }, elevation: 8 },
} as const;
