import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const AVATAR_SIZE = 96;
const PREVIEW_AVATAR_SIZE = 64;
const PREVIEW_COUNT = 3;

/**
 * Placeholder for `ProfileHeader` (`profile/index.tsx`'s and
 * `profile/[id].tsx`'s own shared avatar/name/info header) while the
 * screen's combined `Promise.all` fetch is in flight — matches its real
 * left-aligned row layout (96px avatar left, stacked text bars right) so
 * the skeleton-to-content swap doesn't jump. Both profile screens show one
 * single loading state for their entire fetch (no per-field streaming the
 * way web's Server Components allow), so this is one block rather than
 * several independently-loading pieces.
 *
 * `withAction` reserves space for whatever `ProfileHeader`'s own
 * `children` slot ends up holding once loaded — `profile/[id].tsx`'s Sign
 * Out button or friend/trainer-request row; `profile/index.tsx` never
 * passes `withAction` since it has nothing in that slot.
 */
export function ProfileHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View style={styles.header}>
      <View style={[styles.avatar, bg]} />
      <View style={styles.headerText}>
        <View style={[styles.bar, styles.name, bg]} />
        <View style={[styles.bar, styles.infoWide, bg]} />
        <View style={[styles.bar, styles.infoNarrow, bg]} />
        <View style={[styles.bar, styles.link, bg]} />
        {withAction && <View style={[styles.bar, styles.actionButton, bg]} />}
      </View>
    </View>
  );
}

/**
 * Placeholder for `FriendsPreview`/`PeoplePreview` while the profile
 * screen's own fetch is in flight — same header-row + avatar-grid shape as
 * those two real components, capped at `PREVIEW_COUNT` (3) to match what
 * they actually ever render. `showSeeAll` covers the one real difference
 * between the two call sites: `FriendsPreview` has a "see all" link next
 * to its title, `PeoplePreview` (the trainer/client block) doesn't.
 */
export function ProfilePeopleSkeleton({ showSeeAll = false }: { showSeeAll?: boolean }) {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View>
      <View style={styles.peopleHeader}>
        <View style={[styles.bar, styles.peopleTitle, bg]} />
        {showSeeAll && <View style={[styles.bar, styles.seeAll, bg]} />}
      </View>
      <View style={styles.grid}>
        {Array.from({ length: PREVIEW_COUNT }).map((_, index) => (
          <View key={index} style={styles.item}>
            <View style={[styles.previewAvatar, bg]} />
            <View style={[styles.bar, styles.itemName, bg]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: Spacing.one,
  },
  headerText: {
    flex: 1,
    gap: Spacing.two,
    justifyContent: 'center',
  },
  bar: {
    borderRadius: Spacing.one,
  },
  name: {
    width: 140,
    height: 22,
  },
  infoWide: {
    width: 180,
    height: 16,
  },
  infoNarrow: {
    width: 120,
    height: 16,
  },
  link: {
    width: 90,
    height: 16,
    marginTop: Spacing.one,
  },
  // Matches `Button`'s own typical compact size — stands in for either
  // the Sign Out button (own profile viewed via a shared link) or the
  // friend/trainer-request button row (someone else's profile).
  actionButton: {
    width: 140,
    height: 36,
    marginTop: Spacing.one,
  },
  peopleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  peopleTitle: {
    width: 100,
    height: 20,
  },
  seeAll: {
    width: 150,
    height: 20,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  item: {
    alignItems: 'center',
    width: PREVIEW_AVATAR_SIZE,
    gap: Spacing.one,
  },
  previewAvatar: {
    width: PREVIEW_AVATAR_SIZE,
    height: PREVIEW_AVATAR_SIZE,
    borderRadius: Spacing.one,
  },
  itemName: {
    width: PREVIEW_AVATAR_SIZE,
    height: 16,
  },
});
