import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/lib/i18n';
import { type City, getNearestCity, resolveCityLabel, searchCities } from '@/lib/supabase/cities';

type CityLabel = { name: string; country: string };

type CitySelectProps = {
  city: string | null;
  country: string | null;
  onSelect: (city: CityLabel) => void;
};

type DetectStatus =
  | { state: 'idle' }
  | { state: 'detecting' }
  | { state: 'error'; message: string };

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

function formatCity(city: CityLabel): string {
  return `${city.name}, ${city.country}`;
}

/**
 * Hand-rolled text input + inline suggestion list (no third-party
 * autocomplete widget — matches this app's all-custom component
 * architecture) plus a "detect automatically" action backed entirely by
 * the self-hosted `cities`/`nearest_city` lookup, never an external
 * geocoding API. Suggestions render inline below the input rather than
 * as an absolutely-positioned overlay — this screen already lives inside
 * a scrolling `Workspace`, and an overlay would risk clipping/z-index
 * fights with that scroll container for no real benefit here.
 */
export function CitySelect({ city, country, onSelect }: CitySelectProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const lang: SupportedLanguage = SUPPORTED_LANGUAGES.includes(i18n.language as SupportedLanguage)
    ? (i18n.language as SupportedLanguage)
    : 'en';

  const persistedText = city ? (country ? formatCity({ name: city, country }) : city) : '';
  const [query, setQuery] = useState(persistedText);
  const [dirty, setDirty] = useState(false);
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [searching, setSearching] = useState(false);
  const [detectStatus, setDetectStatus] = useState<DetectStatus>({ state: 'idle' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-seeds the displayed text if the persisted value changes out from
  // under this component (e.g. a just-finished detect-location write),
  // but never while the user is mid-edit. Adjusted during render (React's
  // own recommended pattern for "reset state when a prop changes") rather
  // than in an effect, so there's no synchronous setState-in-effect call.
  const [lastPersistedText, setLastPersistedText] = useState(persistedText);
  if (persistedText !== lastPersistedText) {
    setLastPersistedText(persistedText);
    if (!dirty) setQuery(persistedText);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!dirty || query.trim().length < MIN_QUERY_LENGTH) return;
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      searchCities(query)
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, dirty]);

  const handleChangeText = (text: string) => {
    setQuery(text);
    setDirty(true);
  };

  const handleSelect = (selected: City) => {
    const label = resolveCityLabel(selected, lang);
    setQuery(formatCity(label));
    setDirty(false);
    setSuggestions([]);
    onSelect(label);
  };

  const handleDetect = async () => {
    setDetectStatus({ state: 'detecting' });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDetectStatus({ state: 'error', message: t('profile.settings.locationError') });
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const nearest = await getNearestCity(position.coords.latitude, position.coords.longitude);
      if (!nearest) {
        setDetectStatus({ state: 'error', message: t('profile.settings.locationError') });
        return;
      }
      handleSelect(nearest);
      setDetectStatus({ state: 'idle' });
    } catch {
      setDetectStatus({ state: 'error', message: t('profile.settings.locationError') });
    }
  };

  const queryLongEnough = query.trim().length >= MIN_QUERY_LENGTH;
  const showSuggestions = dirty && queryLongEnough && suggestions.length > 0;
  const showNoMatches = dirty && queryLongEnough && !searching && suggestions.length === 0;

  return (
    <ThemedView style={styles.container}>
      <TextInput
        value={query}
        onChangeText={handleChangeText}
        placeholder={t('profile.settings.cityPlaceholder')}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        autoCapitalize="words"
        autoCorrect={false}
      />

      {showSuggestions && (
        <ThemedView type="backgroundElement" style={[styles.suggestions, { borderColor: theme.border }]}>
          {suggestions.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleSelect(item)}
              style={({ pressed }) => [
                styles.suggestionRow,
                pressed && { backgroundColor: theme.backgroundSelected },
              ]}
            >
              <ThemedText type="small">{formatCity(resolveCityLabel(item, lang))}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      )}

      {showNoMatches && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('profile.settings.noMatches')}
        </ThemedText>
      )}

      <Pressable
        onPress={handleDetect}
        disabled={detectStatus.state === 'detecting'}
        style={styles.detectRow}
      >
        {detectStatus.state === 'detecting' ? (
          <ActivityIndicator size="small" color={theme.textSecondary} />
        ) : (
          <ThemedText type="linkPrimary">{t('profile.settings.detectLocation')}</ThemedText>
        )}
      </Pressable>

      {detectStatus.state === 'error' && (
        <ThemedText type="small" themeColor="danger">
          ❌ {detectStatus.message}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 40,
    borderWidth: 2,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  suggestions: {
    borderWidth: 1,
    borderRadius: Spacing.one,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  detectRow: {
    alignSelf: 'flex-start',
  },
});
