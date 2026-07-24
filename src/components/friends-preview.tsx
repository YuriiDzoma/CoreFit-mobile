import { Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { type Profile } from '@/lib/supabase/profile';

const PREVIEW_COUNT = 3;
const PREVIEW_AVATAR_SIZE = 64;

interface FriendsPreviewProps {
  friends: Profile[];
  /** The real total, independent of how many `friends` actually holds —
   * deliberately not derived from `friends.length` here, so a future
   * upstream truncation can't silently make this undercount the way
   * web's own equivalent does (it caps the profile fetch at 12 but still
   * displays that capped length as the total). */
  totalCount: number;
  onFriendPress: (id: string) => void;
  onSeeAllPress: () => void;
}

/**
 * Pure rendering of an already-fetched, already-resolved friends list —
 * no fetching, no loading/error/empty state, matching `ProgramsList`'s own
 * documented shape. Callers must not render this at all when `totalCount`
 * is 0 (own profile and another user's profile both hide the whole block
 * rather than show an empty-state prompt — see docs/decisions.md).
 *
 * Deliberately not built on `UserCard` — a preview needs to read as visibly
 * distinct from the full Friends list (a short row-list would just look
 * like the same list cut short), matching web's own equivalent (a compact
 * avatar-above-name grid, not its full list's avatar-beside-name rows).
 * Each item here is its own small `Pressable` (avatar + name, no chevron —
 * a preview item isn't a navigable row the way a full list row is), capped
 * at `PREVIEW_COUNT` regardless of `totalCount` — this stays a preview, not
 * a second full list.
 *
 * The whole block is one outer `Pressable` (→ `onSeeAllPress`), with each
 * item's own `Pressable` nested inside. React Native's touch responder
 * system gives a tap to whichever is most specific, so tapping a friend
 * goes to their profile and tapping anywhere else in the block (heading,
 * "See all friends", surrounding space) goes to the full list — no manual
 * touch-handling needed for the two to coexist correctly.
 */
export function FriendsPreview({ friends, totalCount, onFriendPress, onSeeAllPress }: FriendsPreviewProps) {
  return (
    <Pressable onPress={onSeeAllPress}>
      <ThemedView style={styles.header}>
        <ThemedText type="smallBold">Friends: {totalCount}</ThemedText>
        <ThemedText type="linkPrimary">See all friends</ThemedText>
      </ThemedView>

      <ThemedView style={styles.grid}>
        {friends.slice(0, PREVIEW_COUNT).map((friend) => (
          <Pressable key={friend.id} style={styles.item} onPress={() => onFriendPress(friend.id)}>
            <Avatar uri={friend.avatar_url} name={friend.username} size={PREVIEW_AVATAR_SIZE} />
            <ThemedText type="small" style={styles.itemName} numberOfLines={2}>
              {friend.username ?? 'Unknown'}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    // 'flex-start', not the row default of 'stretch' — a two-line name on
    // one item shouldn't stretch its neighbors' shorter one-line items to
    // match its height.
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  item: {
    alignItems: 'center',
    width: PREVIEW_AVATAR_SIZE,
    gap: Spacing.one,
  },
  itemName: {
    textAlign: 'center',
  },
});
