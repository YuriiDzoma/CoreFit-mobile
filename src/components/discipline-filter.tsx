import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveEffectiveScheme, useTheme } from '@/hooks/use-theme';
import { DISCIPLINES, type Discipline } from '@/lib/supabase/exercises';
import { useAuthStore } from '@/stores/auth-store';

type DisciplineFilterProps = {
  selected: Discipline | null;
  onSelect: (discipline: Discipline | null) => void;
};

// Same active fill as MuscleGroupFilter's tabs (web's `--submit-bg`), so the
// two filters stacked above the list read as one control family.
const ACTIVE_TAB_BG = { light: '#fff', dark: '#203045' };

/**
 * All / Strength / Cardio / CrossFit (Sprint 153) -- a row of four equal
 * segments above the muscle-group rail in the Wiki and the exercise
 * picker. Combines with the muscle group and the search; an exercise in
 * several disciplines shows under each.
 */
export function DisciplineFilter({ selected, onSelect }: DisciplineFilterProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const osScheme = useColorScheme();
  const themePreference = useAuthStore((state) => state.themePreference);
  const scheme = resolveEffectiveScheme(osScheme, themePreference);
  const activeTabBg = scheme === 'dark' ? ACTIVE_TAB_BG.dark : ACTIVE_TAB_BG.light;

  const options: { key: Discipline | null; label: string }[] = [
    { key: null, label: t('components.disciplineFilter.all') },
    ...DISCIPLINES.map((key) => ({ key, label: t(`components.disciplineFilter.${key}`) })),
  ];

  return (
    <View style={styles.row}>
      {options.map(({ key, label }) => {
        const isSelected = selected === key;
        return (
          <Pressable
            key={key ?? 'all'}
            onPress={() => onSelect(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.segment,
              { borderColor: isSelected ? theme.border : theme.glassBorder },
              isSelected && { backgroundColor: activeTabBg, borderWidth: 2 },
            ]}
          >
            <ThemedText style={[styles.label, isSelected && styles.labelActive]} numberOfLines={1}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    // Same reason as MuscleGroupFilter's `nav`: on react-native-web a View
    // above a flex:1 list would otherwise shrink below its own height.
    flexShrink: 0,
  },
  segment: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  label: {
    fontSize: 13,
  },
  labelActive: {
    fontWeight: '700',
  },
});
