import { SymbolView } from 'expo-symbols';
import { type ReactNode } from 'react';
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
}

/**
 * A profile row — avatar, name, tap-through to `/profile/[id]` — shared by
 * the Users and Friends screens. Not built on top of `ProgramCard`: the
 * content differs (an image-or-initial avatar, not program metadata), and
 * this project has no shared base "Card" component for two call sites to
 * extract into either — visual consistency comes from reusing the same
 * `Spacing`/theme tokens, matching how `ProgramCard` itself is styled.
 */
export function UserCard({ profile, onPress, action }: UserCardProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress}>
      <ThemedView style={[styles.card, { borderColor: theme.border }]}>
        <Avatar uri={profile.avatar_url} name={profile.username} size={40} />
        <ThemedText style={styles.name} numberOfLines={1}>
          {profile.username ?? 'Unknown user'}
        </ThemedText>
        {action}
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={16}
          tintColor={theme.textSecondary}
        />
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.one,
    padding: Spacing.three,
  },
  name: {
    flex: 1,
  },
});
