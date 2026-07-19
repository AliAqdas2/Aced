import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';

export function useColors() {
  const scheme = useColorScheme() ?? 'light';
  return scheme === 'dark' ? colors.dark : colors.light;
}
