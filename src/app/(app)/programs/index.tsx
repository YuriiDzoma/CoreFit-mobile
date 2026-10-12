import { router, useLocalSearchParams } from 'expo-router';
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
import { getProfileById } from '@/lib/supabase/profile';
import { useAuthStore } from '@/stores/auth-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; programs: ProgramRow[]; viewedName: string | null }
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

  // Absent → the signed-in user's own programs (unchanged from before this
  // param existed). Present → someone else's — reached from their
  // profile's "Programs" link, matching `profile/friends.tsx`'s identical
  // `userId` param for the same purpose. A self-referencing id
  // (?userId=<your own id>) degrades safely to the own-profile case below.
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const paramUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const subjectId = paramUserId ?? user?.id;
  const isOwnProfile = !paramUserId || paramUserId === user?.id;

  // Only sets state inside the .then/.catch continuations, never
  // synchronously at call time — safe to invoke directly from the effect.
  const fetchData = (userId: string) => {
    Promise.all([getPrograms(userId), isOwnProfile ? Promise.resolve(null) : getProfileById(userId)])
      .then(([programs, profile]) =>
        setLoadState({ state: 'success', programs, viewedName: profile?.username ?? null }),
      )
      .catch((error: Error) => setLoadState({ state: 'error', message: error.message }));
  };

  // Keyed on subjectId, not user?.id, so navigating from one user's
  // programs to another's (or to your own) re-fetches — matches
  // `profile/friends.tsx`'s identical `userId`-param screen.
  useEffect(() => {
    if (subjectId) {
      fetchData(subjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchData closes over isOwnProfile, which is itself derived from subjectId
  }, [subjectId]);

  const handleRetry = () => {
    if (!subjectId) return;
    setLoadState({ state: 'loading' });
    fetchData(subjectId);
  };

  const title =
    loadState.state === 'success' && loadState.viewedName
      ? t('programs.index.titleWithName', { name: loadState.viewedName })
      : t('programs.index.title');

  return (
    <Workspace justify="flex-start" contentStyle={{ gap: Spacing.three }}>
      <ThemedText type="pageTitle" style={{ marginTop: clearance.top }}>
        {title}
      </ThemedText>

      {/* Web's create link (programs.module.scss's .createLink) sits
          right after the title, not duplicated between empty/non-empty
          states — matched here with a loading placeholder in its place
          while the initial fetch is still in flight. Own-profile only —
          matches `[id].tsx`'s identical gate before this screen could show
          another user's own programs at all. */}
      {isOwnProfile &&
        (loadState.state === 'loading' ? (
          <ProgramCreateSkeleton />
        ) : (
          <ThemedView style={styles.createLink}>
            <Button onPress={handleCreatePress} variant="filled">
              <ThemedText type="small">{t('programs.index.createNew')}</ThemedText>
            </Button>
          </ThemedView>
        ))}

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
            {isOwnProfile ? t('programs.index.emptyOwn') : t('programs.index.emptyOther')}
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
