// Atelier "Coquette" palette, from the hi-fi prototype (Claude Design, 2026-10-10).
export const palette = {
  blush50: '#FFF8FB', blush60: '#FDF2F5', blush75: '#FFF5F8', blush100: '#FCEEF3', blush150: '#FCE3EC', blush200: '#FFE4EE', blush250: '#F7CFDD', blush280: '#F5D3E0', blush300: '#F5B6D0', blush400: '#F4B6CB',
  line100: '#F0DCE5', line200: '#F0CFDD', line300: '#EBC3D5',
  rose400: '#C76B93', rose500: '#B64D75', rose600: '#9F3F64', rose700: '#9A3D62', rose800: '#7A2F55',
  plum900: '#4A1B33', // headline ink (v4 screens)
  plum950: '#491F32', // deepest plum, only for photo scrims
  ink900: '#49313B', ink700: '#6E5262', ink500: '#896F7D', ink300: '#C2B0B9',
  sage600: '#2F6B47', amber500: '#D9A04A',
  white: '#FFFFFF',
  error500: '#C24A4A', error100: '#F9E3E3',
  scrim: '#49313B88', // ink900 at ~53% alpha, for modal backdrops
} as const;
