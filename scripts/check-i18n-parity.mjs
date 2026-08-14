#!/usr/bin/env node
// Verifies that all 4 locale files (src/lib/i18n/locales/*.json) define the
// same set of keys. `en.json` is the source of truth. i18next plural keys
// (`foo_one`/`foo_few`/`foo_many`/`foo_other`/`foo_zero`) are treated as a
// single logical key `foo` for the base existence check, since English only
// ever needs `_one`/`_other` while Ukrainian/Russian/Polish need the full
// CLDR set — that divergence is expected, not a bug. For any key detected
// as pluralized in *any* locale, uk/ru/pl are separately required to carry
// the full four-form set (`_one`/`_few`/`_many`/`_other`), since a missing
// form there is a real content gap, not a language-count difference.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '..', 'src', 'lib', 'i18n', 'locales');
const LANGUAGES = ['en', 'uk', 'ru', 'pl'];
const SLAVIC_LANGUAGES = ['uk', 'ru', 'pl'];
const PLURAL_SUFFIXES = ['zero', 'one', 'few', 'many', 'other'];

function loadLocale(lang) {
  const raw = readFileSync(path.join(LOCALES_DIR, `${lang}.json`), 'utf-8');
  return JSON.parse(raw);
}

function flatten(obj, prefix = '') {
  const keys = [];
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flatten(value, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function pluralSuffixOf(key) {
  const match = key.match(/^(.*)_(zero|one|few|many|other)$/);
  return match ? { base: match[1], suffix: match[2] } : null;
}

function toBaseKeySet(keys) {
  const bases = new Set();
  for (const key of keys) {
    const plural = pluralSuffixOf(key);
    bases.add(plural ? plural.base : key);
  }
  return bases;
}

const locales = Object.fromEntries(LANGUAGES.map((lang) => [lang, loadLocale(lang)]));
const keysByLang = Object.fromEntries(
  LANGUAGES.map((lang) => [lang, flatten(locales[lang])]),
);

let failed = false;

// 1. Base-key parity: every language must cover the same logical keys as en,
// ignoring which specific plural suffixes are present.
const enBaseKeys = toBaseKeySet(keysByLang.en);
for (const lang of LANGUAGES) {
  if (lang === 'en') continue;
  const baseKeys = toBaseKeySet(keysByLang[lang]);
  const missing = [...enBaseKeys].filter((k) => !baseKeys.has(k));
  const extra = [...baseKeys].filter((k) => !enBaseKeys.has(k));
  if (missing.length > 0) {
    failed = true;
    console.error(`[${lang}] missing keys present in en.json:`);
    for (const k of missing) console.error(`  - ${k}`);
  }
  if (extra.length > 0) {
    failed = true;
    console.error(`[${lang}] extra keys not present in en.json:`);
    for (const k of extra) console.error(`  - ${k}`);
  }
}

// 2. Plural-form completeness: any base key pluralized in ANY locale must
// carry the full _one/_few/_many/_other set in uk/ru/pl specifically.
const pluralBases = new Set();
for (const lang of LANGUAGES) {
  for (const key of keysByLang[lang]) {
    const plural = pluralSuffixOf(key);
    if (plural) pluralBases.add(plural.base);
  }
}
const REQUIRED_SLAVIC_SUFFIXES = ['one', 'few', 'many', 'other'];
for (const base of pluralBases) {
  for (const lang of SLAVIC_LANGUAGES) {
    const present = new Set(
      keysByLang[lang]
        .map(pluralSuffixOf)
        .filter((p) => p && p.base === base)
        .map((p) => p.suffix),
    );
    const missingSuffixes = REQUIRED_SLAVIC_SUFFIXES.filter((s) => !present.has(s));
    if (missingSuffixes.length > 0) {
      failed = true;
      console.error(
        `[${lang}] "${base}" is missing plural form(s): ${missingSuffixes.map((s) => `${base}_${s}`).join(', ')}`,
      );
    }
  }
}

if (failed) {
  console.error('\ni18n key parity check FAILED.');
  process.exit(1);
}

console.log(`i18n key parity OK — ${enBaseKeys.size} base keys across ${LANGUAGES.length} locales.`);
