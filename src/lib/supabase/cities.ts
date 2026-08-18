import { z } from 'zod';

import type { SupportedLanguage } from '@/lib/i18n';
import { supabase } from '@/lib/supabase/client';

/**
 * All direct Supabase calls against the `cities` reference table and its
 * `nearest_city`/`search_cities` RPCs live here, mirroring `profile.ts`'s
 * own shape. The table is a self-hosted seed of ~600 major world cities
 * (no external geocoding API, no API keys — an explicit product
 * decision) with public read-only RLS, so every call here is a plain
 * SELECT/RPC with no auth branching.
 */

const citySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  name_uk: z.string().nullable(),
  name_ru: z.string().nullable(),
  country: z.string(),
  country_code: z.string(),
});

export type City = z.infer<typeof citySchema>;

// `cities` also carries `name_uk`/`name_ru`, populated for Ukraine/Russia
// plus a shortlist of other major world cities — used both to match a
// Cyrillic-script search query (English-only `name` would never match
// one) and to display/persist the city in whichever of the 4 app
// languages is currently active. Country names aren't stored per-city
// (every row of the same country would otherwise repeat, and risk
// drifting out of sync) — this small lookup covers exactly the country
// codes that have at least one translated city, so a translated city
// name is never paired with an untranslated country name.
const COUNTRY_NAMES_UK: Record<string, string> = {
  UA: 'Україна', RU: 'Росія', PL: 'Польща', DE: 'Німеччина', FR: 'Франція',
  ES: 'Іспанія', IT: 'Італія', NL: 'Нідерланди', AT: 'Австрія', CH: 'Швейцарія',
  CZ: 'Чехія', HU: 'Угорщина', RO: 'Румунія', GR: 'Греція', PT: 'Португалія',
  DK: 'Данія', SE: 'Швеція', NO: 'Норвегія', FI: 'Фінляндія', GB: 'Велика Британія',
  IE: 'Ірландія', BE: 'Бельгія', BY: 'Білорусь', MD: 'Молдова', LT: 'Литва',
  LV: 'Латвія', EE: 'Естонія', TR: 'Туреччина', CN: 'Китай', JP: 'Японія',
  KR: 'Південна Корея', TH: 'Таїланд', SG: 'Сінгапур', AE: 'ОАЕ', EG: 'Єгипет',
  US: 'США', CA: 'Канада', AU: 'Австралія', MX: 'Мексика', AR: 'Аргентина',
  BR: 'Бразилія', IL: 'Ізраїль',
};

const COUNTRY_NAMES_RU: Record<string, string> = {
  UA: 'Украина', RU: 'Россия', PL: 'Польша', DE: 'Германия', FR: 'Франция',
  ES: 'Испания', IT: 'Италия', NL: 'Нидерланды', AT: 'Австрия', CH: 'Швейцария',
  CZ: 'Чехия', HU: 'Венгрия', RO: 'Румыния', GR: 'Греция', PT: 'Португалия',
  DK: 'Дания', SE: 'Швеция', NO: 'Норвегия', FI: 'Финляндия', GB: 'Великобритания',
  IE: 'Ирландия', BE: 'Бельгия', BY: 'Беларусь', MD: 'Молдова', LT: 'Литва',
  LV: 'Латвия', EE: 'Эстония', TR: 'Турция', CN: 'Китай', JP: 'Япония',
  KR: 'Южная Корея', TH: 'Таиланд', SG: 'Сингапур', AE: 'ОАЭ', EG: 'Египет',
  US: 'США', CA: 'Канада', AU: 'Австралия', MX: 'Мексика', AR: 'Аргентина',
  BR: 'Бразилия', IL: 'Израиль',
};

// Mirrors `getExerciseName`'s own per-language fallback shape (web's
// `complexes.tsx`/`wiki.tsx`): Ukrainian/Russian use their own column
// when populated, everything else (English, Polish — Polish has no
// dedicated column here, same as exercises) falls back to the canonical
// `name`/`country`.
export function resolveCityLabel(
  city: City,
  lang: SupportedLanguage,
): { name: string; country: string } {
  if (lang === 'uk' && city.name_uk) {
    return { name: city.name_uk, country: COUNTRY_NAMES_UK[city.country_code] ?? city.country };
  }
  if (lang === 'ru' && city.name_ru) {
    return { name: city.name_ru, country: COUNTRY_NAMES_RU[city.country_code] ?? city.country };
  }
  return { name: city.name, country: city.country };
}

// Empty/near-empty queries would just return the highest-population
// cities globally, not a useful "still typing" state — short-circuit
// before hitting the network at all.
const MIN_QUERY_LENGTH = 2;

export async function searchCities(query: string): Promise<City[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const { data, error } = await supabase.rpc('search_cities', { query: trimmed });
  if (error) throw error;
  return z.array(citySchema).parse(data);
}

export async function getNearestCity(lat: number, lng: number): Promise<City | null> {
  const { data, error } = await supabase
    .rpc('nearest_city', { target_lat: lat, target_lng: lng })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return citySchema.parse(data);
}
