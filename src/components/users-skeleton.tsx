import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ROW_COUNT = 3;
const AVATAR_SIZE = 40;
const SEARCH_HEIGHT = 40;

/**
 * Placeholder for the Users screen while its profile list is loading —
 * `UserCard`'s default `outlined` shape (`Spacing.three` padding, 40px
 * avatar), a text-sized placeholder for the row's action (a plain text
 * link there, not a `Button`) and the trailing chevron, plus the
 * `SearchBar` on top (border included). The page title above this
 * renders independently (its own loading state), so this only covers the
 * search bar and list.
 *
 * `withAction={false}` for the new-message picker, whose rows have no
 * action, only the chevron.
 */
export function UsersSkeleton({ withAction = true }: { withAction?: boolean }) {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.search,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      />

      <View style={styles.list}>
        {Array.from({ length: ROW_COUNT }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.card,
              { backgroundColor: theme.workspace, borderColor: theme.border },
            ]}
          >
            <View style={[styles.avatar, bg]} />
            <View style={styles.nameCol}>
              <View style={[styles.name, bg]} />
            </View>
            {withAction && <View style={[styles.action, bg]} />}
            <View style={[styles.chevron, bg]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  search: {
    height: SEARCH_HEIGHT,
    borderRadius: Spacing.two,
    borderWidth: 2,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.one,
    padding: Spacing.three,
    borderWidth: 1,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  nameCol: {
    flex: 1,
  },
  name: {
    width: '60%',
    height: 16,
    borderRadius: Spacing.one,
  },
  action: {
    width: 90,
    height: 16,
    borderRadius: Spacing.one,
  },
  chevron: {
    width: 16,
    height: 16,
    borderRadius: Spacing.one,
  },
});
