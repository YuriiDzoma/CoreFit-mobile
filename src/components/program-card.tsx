import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ElevatedCard } from '@/components/elevated-card';
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
  /** 'outlined' (default) is the existing bordered look, still used by
   * Complexes and another user's profile programs list. 'elevated' swaps
   * the surface for the shared `ElevatedCard` — currently only the My
   * Programs list opts into it; not yet rolled out everywhere `ProgramCard`
   * renders. */
  variant?: 'outlined' | 'elevated';
};

const ARROW_ICON_SIZE = 32;

/**
 * Stage 1, Web → Mobile parity: every value here is read directly from
 * `app/training/components/programs/ProgramItem.tsx` /
 * `programs.module.scss`, not estimated — centered title/subtitle
 * (`span`/`p`, `text-align:center`), 8px padding (not 16), 4px gap
 * between title and subtitle (`span{margin-bottom:4px}`, not 2), and a
 * 32×32 arrow icon absolutely positioned at `right:32px`, vertically
 * centered — not a small trailing chevron inline in a flex row. The arrow
 * itself is `linkToWhite.svg`/`linkToDark.svg`'s exact path (not a system
 * symbol/icon-font lookalike — those render a differently-proportioned
 * arrowhead), redrawn with `react-native-svg`; color confirmed against
 * that source too: `#fff` / `#19355A`, both exact `theme.text` matches.
 */
export function ProgramCard({ program, onPress, badge, variant = 'outlined' }: ProgramCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const content = (
    <>
      <ThemedView style={[styles.textStack, { backgroundColor: 'transparent' }]}>
        <ThemedText style={styles.title}>{program.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          {formatProgramType(t, program.type)} • {formatProgramLevel(t, program.level)} •{' '}
          {t('components.programCard.days', { count: program.days_count })}
        </ThemedText>
      </ThemedView>

      {badge && <View style={styles.badgeSlot}>{badge}</View>}

      <View style={styles.arrow}>
        <Svg width={ARROW_ICON_SIZE} height={ARROW_ICON_SIZE} viewBox="0 0 24 24" fill="none">
          <Path
            d="M15 8L19 12M19 12L15 16M19 12H5"
            stroke={theme.text}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </>
  );

  if (variant === 'elevated') {
    return (
      <Pressable onPress={onPress}>
        <ElevatedCard style={styles.elevatedCard}>{content}</ElevatedCard>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <ThemedView
        style={[styles.card, { backgroundColor: theme.workspace, borderColor: theme.border }]}
      >
        {content}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // "Outlined" — page-background fill, just a `theme.border` hairline (no
  // shadow/elevation). A shadow-lifted `backgroundElement` fill read fine
  // in light mode but nearly disappeared in dark mode (a black shadow on
  // an already-dark surface has no contrast to lift against). Chosen
  // after comparing 5 side-by-side variants — this one also happens to
  // match web's own `.programItem` (`border:1px solid var(--border-color)`,
  // no shadow, no fill override) exactly, for free.
  card: {
    borderRadius: Spacing.one,
    padding: Spacing.two,
    borderWidth: 1,
  },
  elevatedCard: {
    padding: Spacing.two,
  },
  textStack: {
    gap: Spacing.one,
  },
  // Web's global reset drops to a 14px base at its own mobile breakpoint
  // (ui/base.scss, @media max-width:769px), and `.programItem p` further
  // overrides that to 12px — neither carries the bold weight ThemedText's
  // 'default'/'small' types apply elsewhere, so both are set here directly
  // rather than via `type`. `lineHeight` is web's own rendered value (`normal`
  // computes to ~1.176em for title, ~1.166em for subtitle in Roboto), not an
  // estimate — confirmed via live computed-style comparison.
  title: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '400',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
  arrow: {
    position: 'absolute',
    right: 32,
    top: '50%',
    transform: [{ translateY: -(ARROW_ICON_SIZE / 2) }],
  },
  // No web equivalent to measure — top-left corner, per live feedback
  // (previously floated mid-height next to the arrow, where it crowded
  // it and didn't line up with anything else on the card).
  badgeSlot: {
    position: 'absolute',
    left: Spacing.two,
    top: Spacing.two,
  },
});
