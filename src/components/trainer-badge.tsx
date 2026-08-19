import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getTrainerTier, type TrainerTier } from '@/lib/supabase/trainer-clients';

type TrainerBadgeProps = {
  clientCount: number;
};

const TIER_KEYS: Record<TrainerTier, string> = {
  iron: 'tierIron',
  bronze: 'tierBronze',
  silver: 'tierSilver',
  gold: 'tierGold',
};

function tierColors(theme: ReturnType<typeof useTheme>, tier: TrainerTier) {
  switch (tier) {
    case 'iron':
      return { color: theme.tierIron, tint: theme.tierIronTint };
    case 'bronze':
      return { color: theme.tierBronze, tint: theme.tierBronzeTint };
    case 'silver':
      return { color: theme.tierSilver, tint: theme.tierSilverTint };
    case 'gold':
      return { color: theme.tierGold, tint: theme.tierGoldTint };
  }
}

// A small medal glyph — two ribbon ends above a ringed disc with a
// center dot — not a system icon, so it can recolor per tier via a
// single `color` prop the way the rest of this badge does.
function MedalIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 2 L11 10 L5 10 Z" fill={color} />
      <Path d="M16 2 L19 10 L13 10 Z" fill={color} opacity={0.6} />
      <Circle cx={12} cy={15} r={6.5} fill="none" stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={15} r={2.6} fill={color} />
    </Svg>
  );
}

/**
 * Profile-page trainer-level badge — a dedicated row (not an inline chip
 * next to the name, nor an avatar-corner emblem; both were tried and
 * rejected via live-reviewed mockups, see docs/decisions.md) showing an
 * icon, "Trainer · {tier} · {count}" as one compact line — a two-line
 * version (bold title, dimmer count below) read as too large/heavy next
 * to the rest of the profile header per live feedback, so this is one
 * small pill, sized closer to the app's other small badges/pills than
 * to a card. Hidden entirely when `getTrainerTier` returns `null` (0
 * clients) — the same "don't render an empty state" rule `PeoplePreview`
 * already follows, not a new one.
 */
export function TrainerBadge({ clientCount }: TrainerBadgeProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const tier = getTrainerTier(clientCount);
  if (!tier) return null;

  const { color, tint } = tierColors(theme, tier);

  return (
    <View style={[styles.badge, { backgroundColor: tint, borderColor: color }]}>
      <MedalIcon size={14} color={color} />
      <ThemedText type="small" style={[styles.text, { color }]}>
        {t('profile.trainerBadge.label')} · {t(`profile.trainerBadge.${TIER_KEYS[tier]}`)} ·{' '}
        {t('profile.trainerBadge.clientsCount', { count: clientCount })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    marginTop: Spacing.one,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
