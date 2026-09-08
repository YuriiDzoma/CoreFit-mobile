import { SymbolView } from 'expo-symbols';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ElevatedCard } from '@/components/elevated-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatLastActive } from '@/lib/lastActive';
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
  /** 'outlined' (default) is the existing bordered look, still used by
   * Requests/Users. 'elevated' swaps the surface for the shared
   * `ElevatedCard` (see `ProgramCard`'s identical prop) — currently only
   * the Friends list opts into it. */
  variant?: 'outlined' | 'elevated';
  /** Defaults to 40 (Requests/Users unchanged). The Friends list passes a
   * smaller value — asked for a visibly more compact row there, the photo
   * especially. */
  avatarSize?: number;
}

/**
 * A profile row — avatar, name, tap-through to `/profile/[id]` — shared by
 * the Users and Friends screens. Not built on top of `ProgramCard`: the
 * content differs (an image-or-initial avatar, not program metadata), and
 * this project has no shared base "Card" component for two call sites to
 * extract into either — visual consistency comes from reusing the same
 * `Spacing`/theme tokens, matching how `ProgramCard` itself is styled.
 */
export function UserCard({
  profile,
  onPress,
  action,
  hideChevron = false,
  variant = 'outlined',
  avatarSize = 40,
}: UserCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isOnline = formatLastActive(profile.last_active_at)?.isOnline ?? false;
  // Border matches whichever surface is actually behind the dot -- the
  // elevated card's own fill isn't the same color as the outlined card's
  // page-background fill.
  const dotBorderColor = variant === 'elevated' ? theme.elevatedBg : theme.workspace;

  const content = (
    <>
      <View style={styles.avatarWrap}>
        <Avatar uri={profile.avatar_url} name={profile.username} size={avatarSize} />
        {isOnline && (
          <View
            style={[styles.onlineDot, { backgroundColor: theme.success, borderColor: dotBorderColor }]}
          />
        )}
      </View>
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
  // Outlined, matching `ProgramCard`'s own card treatment exactly (page
  // background + a `theme.border` hairline, no shadow) — the shadow this
  // used before read fine in light mode but nearly disappeared in dark
  // mode, the same fix already applied there. Friends/Requests/Users all
  // use that same `Spacing.two` gap.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.one,
    padding: Spacing.three,
    borderWidth: 1,
  },
  // Tighter than `card` — the Friends list asked for a visibly more
  // compact row (smaller photo especially), not just a border swap.
  elevatedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
  },
  name: {
    flex: 1,
  },
  avatarWrap: {
    position: 'relative',
  },
  // Same 10px/2px-border shape as web's own `.onlineDot` (userList.module.scss).
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});
