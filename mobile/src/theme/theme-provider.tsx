import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { lightTheme } from './themes/light';
import type { Theme } from './types';

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // State exists so setTheme (future: dark / re-skin) flips the whole app from one place.
  const [theme] = useState<Theme>(lightTheme);
  const value = useMemo(() => theme, [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
