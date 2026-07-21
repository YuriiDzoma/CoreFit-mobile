import { FlatList, StyleSheet } from 'react-native';

import { ProgramCard } from '@/components/program-card';
import { Spacing } from '@/constants/theme';
import { type ProgramRow } from '@/lib/supabase/programs';

interface ProgramsListProps {
  programs: ProgramRow[];
  onProgramPress: (id: string) => void;
}

/**
 * Pure rendering of an already-fetched program list — no fetching, no
 * loading/error/empty state, no create action. Those vary between call
 * sites (own programs vs. another user's, via `programs/index.tsx` and
 * `profile/[id].tsx`) and stay with the caller; this owns only the part
 * that's identical everywhere: a list of `ProgramCard`s.
 */
export function ProgramsList({ programs, onProgramPress }: ProgramsListProps) {
  return (
    <FlatList
      data={programs}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <ProgramCard program={item} onPress={() => onProgramPress(item.id)} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
});
