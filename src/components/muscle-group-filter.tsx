import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MuscleGroupRow } from '@/lib/supabase/exercises';

type MuscleGroupFilterProps = {
  muscleGroups: MuscleGroupRow[];
  selectedMuscleGroup: string | null;
  onSelect: (muscleGroupId: string | null) => void;
};

export function MuscleGroupFilter({
  muscleGroups,
  selectedMuscleGroup,
  onSelect,
}: MuscleGroupFilterProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      <Pressable
        style={[
          styles.filterPill,
          {
            backgroundColor:
              selectedMuscleGroup === null ? theme.backgroundSelected : theme.backgroundElement,
          },
        ]}
        onPress={() => onSelect(null)}
      >
        <ThemedText type="small">All</ThemedText>
      </Pressable>
      {muscleGroups.map((group) => (
        <Pressable
          key={group.id}
          style={[
            styles.filterPill,
            {
              backgroundColor:
                selectedMuscleGroup === group.id
                  ? theme.backgroundSelected
                  : theme.backgroundElement,
            },
          ]}
          onPress={() => onSelect(group.id)}
        >
          <ThemedText type="small">{group.name}</ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  filterPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
});
