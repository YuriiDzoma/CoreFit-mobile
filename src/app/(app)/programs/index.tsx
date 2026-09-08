import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ProgramsList } from '@/components/programs-list';
import { ProgramCreateSkeleton, ProgramsListSkeleton } from '@/components/programs-list-skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useTrainingChromeClearance } from '@/hooks/use-chrome-clearance';
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
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const clearance = useTrainingChromeClearance();
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
    <Workspace justify="flex-start" contentStyle={{ gap: Spacing.three }}>
      <ThemedText type="pageTitle" style={{ marginTop: clearance.top }}>
        {t('programs.index.title')}
      </ThemedText>

      {/* Web's create link (programs.module.scss's .createLink) sits
          right after the title, not duplicated between empty/non-empty
          states — matched here with a loading placeholder in its place
          while the initial fetch is still in flight. */}
      {loadState.state === 'loading' ? (
        <ProgramCreateSkeleton />
      ) : (
        <ThemedView style={styles.createLink}>
          <Button onPress={handleCreatePress} variant="filled">
            <ThemedText type="small">{t('programs.index.createNew')}</ThemedText>
          </Button>
        </ThemedView>
      )}

      {loadState.state === 'loading' && <ProgramsListSkeleton />}

      {loadState.state === 'error' && (
        <ThemedView style={[styles.errorBlock, { backgroundColor: 'transparent' }]}>
          <ThemedText type="small" themeColor="danger">
            ❌ {loadState.message}
          </ThemedText>
          <Pressable onPress={handleRetry}>
            <ThemedText type="linkPrimary">{t('common.retry')}</ThemedText>
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
            {t('programs.index.emptyOwn')}
          </ThemedText>
        </ThemedView>
      )}

      {loadState.state === 'success' && loadState.programs.length > 0 && (
        <ProgramsList
          programs={loadState.programs}
          onProgramPress={handleProgramPress}
          contentContainerStyle={{ paddingBottom: clearance.bottom }}
          variant="elevated"
        />
      )}
    </Workspace>
  );
}

const styles = StyleSheet.create({
  // `.createLink`: fixed 40px height. No margin-bottom here — the parent
  // `Workspace`'s own `contentStyle` gap (Spacing.three, 16px) already
  // spaces every child from the next; adding one here on top stacked to a
  // 32px gap before the list, double web's actual 16px. `alignItems:
  // 'stretch'` (not 'center') lets the filled Button fill the full width,
  // matching web's `.submit` (`width: 100%`).
  createLink: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'stretch',
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
