import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Local storage for the app's language preference — same web/native split
 * as `authStorage` (`src/lib/supabase/storage.ts`), kept as its own tiny
 * module since that one is typed/scoped for the Supabase auth adapter.
 *
 * Two keys, not one: `LANGUAGE_KEY` alone answers "what language is
 * active," `LANGUAGE_MANUAL_KEY` alone answers "did a human choose this,
 * or did the app guess it" — needed to resolve conflicts against
 * `profiles.language` on login (see `auth-store.ts`).
 */
const LANGUAGE_KEY = 'corefit-language';
const LANGUAGE_MANUAL_KEY = 'corefit-language-is-manual';

function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.localStorage?.getItem(key) ?? null);
  }
  return SecureStore.getItemAsync(key);
}

function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return Promise.resolve();
  }
  return SecureStore.setItemAsync(key, value);
}

export function getStoredLanguage(): Promise<string | null> {
  return getItem(LANGUAGE_KEY);
}

export function isStoredLanguageManual(): Promise<boolean> {
  return getItem(LANGUAGE_MANUAL_KEY).then((value) => value === '1');
}

export function setStoredLanguage(code: string, manual: boolean): Promise<void> {
  const writes = [setItem(LANGUAGE_KEY, code)];
  if (manual) writes.push(setItem(LANGUAGE_MANUAL_KEY, '1'));
  return Promise.all(writes).then(() => undefined);
}
