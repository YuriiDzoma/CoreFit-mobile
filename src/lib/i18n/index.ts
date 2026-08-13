import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { updateProfileById } from '@/lib/supabase/profile';
import {
  getStoredLanguage,
  isStoredLanguageManual,
  setStoredLanguage,
} from '@/lib/i18n/language-storage';
import en from '@/lib/i18n/locales/en.json';
import pl from '@/lib/i18n/locales/pl.json';
import ru from '@/lib/i18n/locales/ru.json';
import uk from '@/lib/i18n/locales/uk.json';

export const SUPPORTED_LANGUAGES = ['en', 'uk', 'ru', 'pl'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

function isSupportedLanguage(code: string | null | undefined): code is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes((code ?? '').toLowerCase() as SupportedLanguage);
}

// Only consulted when nothing has been stored yet — see `initI18n` below.
function detectDeviceLanguage(): SupportedLanguage {
  const deviceCode = Localization.getLocales()[0]?.languageCode?.toLowerCase();
  return isSupportedLanguage(deviceCode) ? deviceCode : DEFAULT_LANGUAGE;
}

let initPromise: Promise<void> | null = null;

/**
 * Resolves the app's language once, in order: a previously stored value
 * (manual or auto — either way, once *something* is stored this branch is
 * what every later launch takes, so device-locale detection genuinely only
 * ever runs on a true first launch) → the device's system language, if
 * supported → `'en'`. Idempotent — safe to call from `_layout.tsx` on every
 * mount.
 */
export function initI18n(): Promise<void> {
  if (!initPromise) {
    initPromise = getStoredLanguage().then((stored) => {
      const language = isSupportedLanguage(stored) ? stored : detectDeviceLanguage();
      const persist = isSupportedLanguage(stored)
        ? Promise.resolve()
        : setStoredLanguage(language, false);
      return persist.then(() =>
        // eslint-disable-next-line import/no-named-as-default-member -- i18next's default export re-exposing `use` as a named export is a known false positive for this rule
        i18n
          .use(initReactI18next)
          .init({
            lng: language,
            fallbackLng: DEFAULT_LANGUAGE,
            resources: {
              en: { translation: en },
              uk: { translation: uk },
              ru: { translation: ru },
              pl: { translation: pl },
            },
            interpolation: { escapeValue: false },
          })
          .then(() => undefined),
      );
    });
  }
  return initPromise;
}

/** Manual pick from Settings — applies instantly (offline-safe), persists
 * locally as the new source of truth, and best-effort mirrors to the
 * user's profile so other devices pick it up on next login. */
export function setLanguagePreference(code: SupportedLanguage, userId?: string): void {
  // eslint-disable-next-line import/no-named-as-default-member -- see initI18n
  i18n.changeLanguage(code);
  setStoredLanguage(code, true);
  if (userId) {
    updateProfileById(userId, { language: code }).catch(() => {});
  }
}

/**
 * Called from `refreshProfilePreferences` (auth-store.ts) on every login.
 * Reconciles this device's local language state against `profiles.language`:
 * a manual local pick wins and is mirrored up; otherwise a manual pick made
 * on another device (found on the profile) wins here and is adopted as this
 * device's own manual pick too, so it's likewise protected from future
 * auto-detection.
 */
export function reconcileLanguageWithProfile(userId: string, profileLanguage: string | null): void {
  isStoredLanguageManual().then((manual) => {
    if (manual) {
      getStoredLanguage().then((local) => {
        if (isSupportedLanguage(local) && local !== profileLanguage) {
          updateProfileById(userId, { language: local }).catch(() => {});
        }
      });
      return;
    }
    if (isSupportedLanguage(profileLanguage)) {
      // eslint-disable-next-line import/no-named-as-default-member -- see initI18n
      i18n.changeLanguage(profileLanguage);
      setStoredLanguage(profileLanguage, true);
    }
  });
}

export default i18n;
