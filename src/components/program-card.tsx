import { SymbolView } from 'expo-symbols';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatProgramLevel, formatProgramType } from '@/lib/format-enums';
import type { ProgramRow } from '@/lib/supabase/programs';

type ProgramCardProps = {
  program: ProgramRow;
  onPress: () => void;
  /** Optional slot for the Complexes list's "Added" indicator — no web
   * equivalent exists to measure against (ProgramItem.tsx has no such
   * slot at all), so its position here is a reasonable placement choice,
   * not a measured value. */
  badge?: ReactNode;
};

const ARROW_ICON_SIZE = 32;

/**
 * Stage 1, Web → Mobile parity: every value here is read directly from
 * `app/training/components/programs/ProgramItem.tsx` /
 * `programs.module.scss`, not estimated — centered title/subtitle
 * (`span`/`p`, `text-align:center`), 8px padding (not 16), 4px gap
 * between title and subtitle (`span{margin-bottom:4px}`, not 2), and a
 * 32×32 arrow icon absolutely positioned at `right:32px`, vertically
 * centered — not a small trailing chevron inline in a flex row. Icon
 * color confirmed against the actual `linkToWhite.svg`/`linkToDark.svg`
 * source: `#fff` / `#19355A`, both exact `theme.text` matches.
 */
export function ProgramCard({ program, onPress, badge }: ProgramCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Pressable onPress={onPress}>
      <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <ThemedView style={[styles.textStack, { backgroundColor: 'transparent' }]}>
          <ThemedText style={styles.title}>{program.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {formatProgramType(t, program.type)} • {formatProgramLevel(t, program.level)} •{' '}
            {t('components.programCard.days', { count: program.days_count })}
          </ThemedText>
        </ThemedView>

        {badge && <View style={styles.badgeSlot}>{badge}</View>}

        {/* SymbolView's native Android view doesn't reliably merge an
            absolute-position style passed directly to it — positioning is
            applied to a plain wrapping View instead, with SymbolView sized
            normally inside it. */}
        <View style={styles.arrow}>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={ARROW_ICON_SIZE}
            tintColor={theme.text}
          />
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // "Elevated" — a filled, shadow-lifted surface instead of the previous
  // navy hairline border. Started as a literal copy of Header/
  // Navigation's shadow recipe, but that one's tuned for a bar floating
  // with generous open space around it — here, `ProgramsList`'s own list
  // `gap` is only 8px between cards, far smaller than that shadow's
  // ~22px spread (offset 6 + radius 16), so the next card in the list
  // physically covers most of it, leaving only a thin grey sliver in the
  // gap instead of a soft halo (confirmed live, on-device — read as
  // "off," not elevated). Scaled down to fit inside an 8px gap instead.
  card: {
    borderRadius: Spacing.one,
    padding: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  textStack: {
    gap: Spacing.one,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  arrow: {
    position: 'absolute',
    right: 32,
    top: '50%',
    transform: [{ translateY: -(ARROW_ICON_SIZE / 2) }],
  },
  // No web equivalent to measure — a reasonable placement left of the
  // arrow icon, not a measured value.
  badgeSlot: {
    position: 'absolute',
    right: 72,
    top: '50%',
    transform: [{ translateY: -9 }],
  },
});
