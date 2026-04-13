import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

export function useColorScheme() {
  const { colorScheme } = useContext(ThemeContext);
  return colorScheme;
}
