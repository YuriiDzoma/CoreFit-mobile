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
 * 3 text pills for. Same one-row-with-scroll shape on every call site,
 * Records included — per live feedback, that's the whole point of the
 * Wiki look, not something to trade away for fitting more on screen.
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
          { borderColor: isSelected ? theme.border : theme.glassBorder },
          isSelected && { backgroundColor: activeTabBg, borderWidth: 2 },
        ]}
        onPress={() => onSelect(id)}
      >
        <Image
          source={source}
          style={{ width: ICON_SIZE, height: ICON_SIZE }}
          contentFit="contain"
        />
        <ThemedText
          style={[styles.tabLabel, isSelected && styles.tabLabelActive]}
          numberOfLines={1}
        >
          {name}
        </ThemedText>
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
    // `flexShrink: 0` is required in addition to `flexGrow: 0` — this row
    // sits above a FlatList inside a `flex: 1` column (Workspace), and on
    // react-native-web (unlike native Yoga, whose default is already
    // flexShrink: 0) plain Views default to CSS's flexShrink: 1, so
    // without this the row gets visually compressed below its own fixed
    // height whenever the list below it wants more room than fits.
    // Confirmed live: labels were cropped mid-glyph without this.
    flexGrow: 0,
    flexShrink: 0,
    height: TAB_SIZE,
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
    // The muscle-group icon PNGs sit close to their own top edge (the
    // human silhouette is taller and more evenly padded within its
    // bounding box than the wider muscle glyphs are within theirs), so
    // even with the box's content centered, the icon reads as touching
    // the top border. A one-sided top pad nudges centered content down
    // without disturbing the already-comfortable gap under the label.
    paddingTop: Spacing.one,
    overflow: 'hidden',
  },
  tabLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  // The active tab's fill (`activeTabBg`) is `#fff` in light theme — a
  // web-measured value (`--submit-bg`), but barely distinguishable from
  // the light page background it sits on (confirmed live, on-device: not
  // a rendering bug, both really are that close). A bolder border +
  // label were both already differentiated by nothing at all before this
  // (every tab shared the same 1px `theme.border`/regular-weight label
  // regardless of selection) — adding them gives two more cues that hold
  // up in both themes even where the fill swap alone doesn't.
  tabLabelActive: {
    fontWeight: '700',
  },
});
