import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextType {
  colorScheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  colorScheme: 'light',
  preference: 'system',
  setPreference: () => {},
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemScheme = useSystemColorScheme() ?? 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    SecureStore.getItemAsync('themePreference').then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    SecureStore.setItemAsync('themePreference', pref);
  };

  const colorScheme = preference === 'system' ? systemScheme : preference;

  return (
    <ThemeContext.Provider value={{ colorScheme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
};
