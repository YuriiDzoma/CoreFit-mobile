import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Header } from '@/components/header';
import { ProgramsList } from '@/components/programs-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { BottomTabInset, Spacing } from '@/constants/theme';
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

function handleBrowseComplexesPress() {
  router.push('/programs/complexes');
}

export default function ProgramsScreen() {
  const user = useAuthStore((state) => state.user);
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
      contentStyle={{ paddingBottom: BottomTabInset, gap: Spacing.three }}
    >
      <Header />

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

      {/* Web has no equivalent entry point on this page at all — Complexes
          is reached via header-level secondary navigation there, which
          mobile doesn't have yet. Keeping this inline link in place per
          the Stage 2 review rule: it doesn't conflict with web's visual
          design (web renders nothing in this position), and removing it
          would leave Complexes with no way to be reached at all until
          Navigation (item 5) is addressed. Tracked as a Stage 2 item, not
          a silent deviation. */}
      <Pressable onPress={handleBrowseComplexesPress}>
        <ThemedText type="linkPrimary">Browse Global Programs →</ThemedText>
      </Pressable>

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
