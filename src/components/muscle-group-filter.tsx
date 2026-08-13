import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveEffectiveScheme, useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';
import type { MuscleGroupRow } from '@/lib/supabase/exercises';

type MuscleGroupFilterProps = {
  muscleGroups: MuscleGroupRow[];
  selectedMuscleGroup: string | null;
  onSelect: (muscleGroupId: string | null) => void;
};

// wikiNav.tsx's `isDark ? item.iconLight : item.icon` — counter-intuitively,
// the "Light" file is the one shown in dark theme (it's a light-colored
// icon meant to sit on a dark background). Sourced verbatim from web's
// public/musclesIcons/ (checksum-verified), not redrawn.
const MUSCLE_ICONS: Record<string, { icon: number; iconLight: number }> = {
  chest: {
    icon: require('@/assets/images/muscle-groups/chest.png'),
    iconLight: require('@/assets/images/muscle-groups/chest-light.png'),
  },
  back: {
    icon: require('@/assets/images/muscle-groups/back.png'),
    iconLight: require('@/assets/images/muscle-groups/back-light.png'),
  },
  biceps: {
    icon: require('@/assets/images/muscle-groups/biceps.png'),
    iconLight: require('@/assets/images/muscle-groups/biceps-light.png'),
  },
  triceps: {
    icon: require('@/assets/images/muscle-groups/triceps.png'),
    iconLight: require('@/assets/images/muscle-groups/triceps-light.png'),
  },
  shoulders: {
    icon: require('@/assets/images/muscle-groups/shoulders.png'),
    iconLight: require('@/assets/images/muscle-groups/shoulders-light.png'),
  },
  legs: {
    icon: require('@/assets/images/muscle-groups/legs.png'),
    iconLight: require('@/assets/images/muscle-groups/legs-light.png'),
  },
  abs: {
    icon: require('@/assets/images/muscle-groups/abs.png'),
    iconLight: require('@/assets/images/muscle-groups/abs-light.png'),
  },
};
const ALL_ICON = {
  icon: require('@/assets/images/muscle-groups/all.png'),
  iconLight: require('@/assets/images/muscle-groups/all-light.png'),
};

// wikiNav.tsx/.module.scss's `.tab`/`.tabActive` colors/sizing — measured,
// not estimated. `--submit-bg` (the active-tab fill) has no existing token
// match (closest, backgroundSelected, is a different color entirely), so
// it's inlined here as a single-use, source-derived constant rather than
// added to the global token set for one component.
const ACTIVE_TAB_BG = { light: '#fff', dark: '#203045' };
const TAB_SIZE = 64;
const ICON_SIZE = 32;

/**
 * A horizontal, independently-scrolling rail of bordered 64×64 icon+label
 * tabs, sat above the exercise list rather than beside it — web's own
 * `wikiNav.tsx` is a vertical sidebar, but with Training content now
 * scrolling behind a floating bottom chrome stack (`TrainingSubNav` +
 * `Navigation`), a tall vertical rail could extend its lower items behind
 * that chrome with no way to reach them by scrolling *up* past a list
 * that's scrolling independently in the same direction. A deliberate
 * mobile-native divergence from web's layout, not a parity port — matches
 * the same reasoning `Navigation`'s 5-icon bar already departs from web's
 * 3 text pills for.
 */
export function MuscleGroupFilter({
  muscleGroups,
  selectedMuscleGroup,
  onSelect,
}: MuscleGroupFilterProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const osScheme = useColorScheme();
  const themePreference = useAuthStore((state) => state.themePreference);
  const scheme = resolveEffectiveScheme(osScheme, themePreference);
  const activeTabBg = scheme === 'dark' ? ACTIVE_TAB_BG.dark : ACTIVE_TAB_BG.light;

  const renderTab = (
    id: string | null,
    name: string,
    icons: { icon: number; iconLight: number },
  ) => {
    const isSelected = selectedMuscleGroup === id;
    const source = scheme === 'dark' ? icons.iconLight : icons.icon;
    return (
      <Pressable
        key={id ?? 'all'}
        style={[
          styles.tab,
          { borderColor: theme.border },
          isSelected && { backgroundColor: activeTabBg },
        ]}
        onPress={() => onSelect(id)}
      >
        <Image source={source} style={styles.tabIcon} contentFit="contain" />
        <ThemedText style={styles.tabLabel}>{name}</ThemedText>
      </Pressable>
    );
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.nav}
      contentContainerStyle={styles.navContent}
    >
      {renderTab(null, t('components.muscleGroupFilter.all'), ALL_ICON)}
      {muscleGroups.map((group) =>
        renderTab(group.id, group.name, MUSCLE_ICONS[group.name.toLowerCase()] ?? ALL_ICON),
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: TAB_SIZE,
    flexGrow: 0,
  },
  navContent: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  tab: {
    width: TAB_SIZE,
    minWidth: TAB_SIZE,
    height: TAB_SIZE,
    minHeight: TAB_SIZE,
    borderWidth: 1,
    borderRadius: Spacing.one,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.half,
    overflow: 'hidden',
  },
  tabIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  tabLabel: {
    // `alignItems: 'center'` on the tab sizes children to their intrinsic
    // content width by default, not the tab's own fixed width — an
    // explicit width is needed for the text to wrap within the tab
    // instead of overflowing past its border.
    width: TAB_SIZE - Spacing.one * 2,
    fontSize: 12,
    textAlign: 'center',
  },
});
