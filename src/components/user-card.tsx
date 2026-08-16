import { SymbolView } from 'expo-symbols';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type Profile } from '@/lib/supabase/profile';

interface UserCardProps {
  profile: Profile;
  onPress: () => void;
  /** Right-side slot for a relationship action (Add friend / Cancel
   * request / Remove friend / disabled Pending) — the Users screen passes
   * one, the Friends screen (a plain read-only list) doesn't. Same role as
   * `ProgramCard`'s own `badge` slot. */
  action?: ReactNode;
  /** Suppresses the trailing chevron — for the Friends screen's own
   * "Remove friend" action, which replaces the generic tap-through
   * affordance rather than sitting beside it (unlike Requests/Users,
   * where the chevron stays alongside Accept/Decline/Add/Cancel since
   * those actions don't already imply "you can also just tap through").
   * Default `false` — every other call site keeps the chevron. */
  hideChevron?: boolean;
}

/**
 * A profile row — avatar, name, tap-through to `/profile/[id]` — shared by
 * the Users and Friends screens. Not built on top of `ProgramCard`: the
 * content differs (an image-or-initial avatar, not program metadata), and
 * this project has no shared base "Card" component for two call sites to
 * extract into either — visual consistency comes from reusing the same
 * `Spacing`/theme tokens, matching how `ProgramCard` itself is styled.
 */
export function UserCard({ profile, onPress, action, hideChevron = false }: UserCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Pressable onPress={onPress}>
      <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <Avatar uri={profile.avatar_url} name={profile.username} size={40} />
        <ThemedText style={styles.name} numberOfLines={1}>
          {profile.username ?? t('components.userCard.unknownUser')}
        </ThemedText>
        {action}
        {!hideChevron && (
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={16}
            tintColor={theme.textSecondary}
          />
        )}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Elevated, matching `ProgramCard`'s own card treatment (Sprint 45) —
  // same shadow recipe, already tuned to fit an 8px list gap rather than
  // Header/Navigation's original (too large, mostly hidden by the next
  // row). Friends/Requests/Users all use that same `Spacing.two` gap.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.one,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  name: {
    flex: 1,
  },
});
