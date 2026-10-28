// 4 px scale: key x 4 = px (Tailwind's numbering, shared with admin): theme.spacing[3] is 12.
// The named steps are the original scale, kept so existing code keeps working.
export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
  0.5: 2, 0.75: 3, 1: 4, 1.5: 6, 1.75: 7, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16, 4.5: 18, 5: 20,
  6: 24, 7: 28, 8.5: 34, 10: 40, 12: 48,
} as const;
