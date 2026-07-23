/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/stores/auth-store';

/**
 * A user's explicit `profiles.dark` preference (non-null) always wins;
 * the OS scheme is only the fallback when no preference has ever been set
 * (or none has loaded yet) — shared by `useTheme()` and `_layout.tsx`'s
 * `ThemeProvider` selection so the two can never disagree.
 */
export function resolveEffectiveScheme(
  osScheme: ReturnType<typeof useColorScheme>,
  preference: boolean | null,
): 'light' | 'dark' {
  if (preference !== null) {
    return preference ? 'dark' : 'light';
  }
  return osScheme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const osScheme = useColorScheme();
  const themePreference = useAuthStore((state) => state.themePreference);
  const scheme = resolveEffectiveScheme(osScheme, themePreference);

  return Colors[scheme];
}
