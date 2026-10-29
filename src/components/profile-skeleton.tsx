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
 * `withAction` (someone else's profile, `profile/[id].tsx`) adds the
 * last-active line and the full-width actions row under the header ("Write
 * message" + a friend action, space-between, 8px below) — same layout as
 * the real screen and web's `.profile`; `profile/index.tsx` never passes it.
 */
export function ProfileHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  const header = (
    <View style={styles.header}>
      <View style={[styles.avatar, bg]} />
      <View style={styles.headerText}>
        <View style={[styles.bar, styles.name, bg]} />
        <View style={[styles.bar, styles.infoWide, bg]} />
        {withAction && <View style={[styles.bar, styles.infoNarrow, bg]} />}
        <View style={[styles.bar, styles.infoNarrow, bg]} />
        <View style={[styles.bar, styles.link, bg]} />
      </View>
    </View>
  );

  if (!withAction) return header;

  return (
    <View style={styles.profileBlock}>
      {header}
      <View style={styles.actionsRow}>
        <View style={[styles.bar, styles.actionWide, bg]} />
        <View style={[styles.bar, styles.actionNarrow, bg]} />
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
  // Each bar occupies exactly the line box of the text it stands in for
  // (`ProfileHeader`'s username: 22 line + 8 vertical margin; info lines
  // and the programs link: 20 line), drawn 4px shorter than the line so it
  // still reads as text — otherwise the header grows on load.
  name: {
    width: 140,
    height: 22,
    marginVertical: Spacing.two,
  },
  infoWide: {
    width: 180,
    height: 16,
    marginVertical: Spacing.half,
  },
  infoNarrow: {
    width: 120,
    height: 16,
    marginVertical: Spacing.half,
  },
  link: {
    width: 90,
    height: 16,
    marginTop: Spacing.one + Spacing.half,
    marginBottom: Spacing.half,
  },
  // `profile/[id].tsx`'s actions row: "Write message" + a friend action,
  // both 44px-tall `Button`s, wrapping exactly like the real row.
  profileBlock: {
    gap: Spacing.two,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  // Includes the button's 16px icon + 6px gap.
  actionWide: {
    width: 212,
    height: 44,
  },
  actionNarrow: {
    width: 130,
    height: 44,
  },
  // 30 = `linkPrimary`'s line height (the "see all" link), the taller of
  // the two texts in `FriendsPreview`'s header row.
  peopleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 30,
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
    marginVertical: Spacing.half,
  },
});
