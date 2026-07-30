import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ProgramsList } from '@/components/programs-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';
import { getPrograms, type ProgramRow } from '@/lib/supabase/programs';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; programs: ProgramRow[] }
  | { state: 'error'; message: string };

function handleProgramPress(id: string) {
  router.push(`/programs/${id}`);
}

function handleCreatePress() {
  router.push('/programs/create');
}

export default function ProgramsScreen() {
  const user = useAuthStore((state) => state.user);
  // Training route — top clearance already reserved by
  // `programs/_layout.tsx`'s own wrapper.
  const clearance = useChromeClearance();
  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  const fetchData = (userId: string) => {
    getPrograms(userId)
      .then((programs) => setLoadState({ state: 'success', programs }))
      .catch((error: Error) => setLoadState({ state: 'error', message: error.message }));
  };

  useEffect(() => {
    if (user?.id) {
      fetchData(user.id);
    }
  }, [user?.id]);

  const handleRetry = () => {
    if (!user?.id) return;
    setLoadState({ state: 'loading' });
    fetchData(user.id);
  };

  return (
    <Workspace
      justify="flex-start"
      contentStyle={{ paddingBottom: clearance.bottom + BottomTabInset, gap: Spacing.three }}
    >
      <ThemedText type="default" style={styles.title}>
        My programs
      </ThemedText>

      {/* Web's create link (programs.module.scss's .createLink) is
          unconditional — always rendered right after the title, not
          duplicated between empty/non-empty states. */}
      <ThemedView style={styles.createLink}>
        <Button onPress={handleCreatePress}>
          <ThemedText type="smallBold">+ Create new program</ThemedText>
        </Button>
      </ThemedView>

      {loadState.state === 'loading' && (
        <ThemedText type="small" themeColor="textSecondary">
          Loading programs…
        </ThemedText>
      )}

      {loadState.state === 'error' && (
        <ThemedView style={[styles.errorBlock, { backgroundColor: 'transparent' }]}>
          <ThemedText type="small" themeColor="danger">
            ❌ {loadState.message}
          </ThemedText>
          <Pressable onPress={handleRetry}>
            <ThemedText type="linkPrimary">Retry</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {/* Web's empty state is a plain, non-centered paragraph with no
          repeated button (programs.tsx: `{programs.length === 0 ? <p/> :
          <ul/>}`, button already shown unconditionally above). Mobile's
          existing centered message is kept per the Stage 2 review rule —
          it's a small, self-contained improvement that doesn't conflict
          with web's structure or the shell/navigation — but the duplicate
          button is removed, since the one true create action now lives
          in one place, matching web's actual structure. */}
      {loadState.state === 'success' && loadState.programs.length === 0 && (
        <ThemedView style={[styles.emptyState, { backgroundColor: 'transparent' }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyStateText}>
            You don&apos;t have any programs yet
          </ThemedText>
        </ThemedView>
      )}

      {loadState.state === 'success' && loadState.programs.length > 0 && (
        <ProgramsList programs={loadState.programs} onProgramPress={handleProgramPress} />
      )}
    </Workspace>
  );
}

const styles = StyleSheet.create({
  // base.scss's `.title`: font-weight:500, font-size:20px, centered.
  // `type="default"` already gives weight 500; only size/alignment and
  // the 16px margin-bottom (`.programs h2{margin-bottom:16px}`) are
  // overridden here.
  title: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  // `.createLink`: fixed 40px height, centered both axes, 16px
  // margin-bottom before whatever follows.
  createLink: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
  },
});
