import { FlatList, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ProgramCard } from '@/components/program-card';
import { Spacing } from '@/constants/theme';
import { type ProgramRow } from '@/lib/supabase/programs';

interface ProgramsListProps {
  programs: ProgramRow[];
  onProgramPress: (id: string) => void;
  /** Merged onto the internal `FlatList`'s own `contentContainerStyle` —
   * lets a caller inject bottom clearance (e.g. for a floating nav bar)
   * directly into the actual scrolling widget, rather than an ancestor
   * `Workspace` container, which would shrink this `FlatList`'s own frame
   * instead of just padding its content. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Forwarded to each `ProgramCard` — see its own doc comment. Defaults
   * to the existing outlined look; only the My Programs list opts into
   * 'elevated' so far. */
  variant?: 'outlined' | 'elevated';
}

/**
 * Pure rendering of an already-fetched program list — no fetching, no
 * loading/error/empty state, no create action. Those vary between call
 * sites (own programs vs. another user's, via `programs/index.tsx` and
 * `profile/[id].tsx`) and stay with the caller; this owns only the part
 * that's identical everywhere: a list of `ProgramCard`s.
 */
export function ProgramsList({
  programs,
  onProgramPress,
  contentContainerStyle,
  variant = 'outlined',
}: ProgramsListProps) {
  return (
    <FlatList
      data={programs}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.list, contentContainerStyle]}
      renderItem={({ item }) => (
        <ProgramCard program={item} onPress={() => onProgramPress(item.id)} variant={variant} />
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
