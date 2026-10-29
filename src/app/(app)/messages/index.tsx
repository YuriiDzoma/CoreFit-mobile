import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ConversationRow } from '@/components/conversation-row';
import { MessagesSkeleton } from '@/components/messages-skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';
import {
  clearConversationForMe,
  deleteConversationForEveryone,
} from '@/lib/supabase/messages';
import { useAuthStore } from '@/stores/auth-store';
import {
  isUnreadEntry,
  useMessagesStore,
  type ConversationWithProfile,
} from '@/stores/messages-store';

export default function MessagesScreen() {
  const { t } = useTranslation();
  const clearance = useChromeClearance();
  const user = useAuthStore((state) => state.user);
  const conversations = useMessagesStore((state) => state.conversations);
  const readMarkers = useMessagesStore((state) => state.readMarkers);
  const phase = useMessagesStore((state) => state.phase);
  const error = useMessagesStore((state) => state.error);
  const refresh = useMessagesStore((state) => state.refresh);
  const removeConversation = useMessagesStore((state) => state.removeConversation);

  const [pendingDelete, setPendingDelete] = useState<ConversationWithProfile | null>(null);
  const [alsoForOther, setAlsoForOther] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openDeleteDialog = (entry: ConversationWithProfile) => {
    setPendingDelete(entry);
    setAlsoForOther(false);
    setDeleteError(null);
  };

  // Telegram's choice: unchecked clears the chat for me only (it comes
  // back with the next message); checked deletes it for both.
  const handleConfirmDelete = () => {
    if (!pendingDelete || !user?.id) return;
    const conversationId = pendingDelete.conversation.id;
    setDeleting(true);
    setDeleteError(null);
    (alsoForOther
      ? deleteConversationForEveryone(conversationId)
      : clearConversationForMe(conversationId, user.id)
    )
      .then(() => {
        removeConversation(conversationId);
        setPendingDelete(null);
      })
      .catch((error: Error) => setDeleteError(error.message))
      .finally(() => setDeleting(false));
  };

  // The realtime subscription (auth-provider.tsx) already fetches on
  // sign-in, so this is only a safety net for arriving here with a
  // phase that's stuck in 'error', or before that subscription's first
  // fetch has resolved yet.
  const handleRetry = () => {
    if (user?.id) refresh(user.id);
  };

  useEffect(() => {
    if (user?.id && phase === 'error') {
      refresh(user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-runs on a genuine error -> retry transition, not every phase change
  }, [user?.id]);

  return (
    <Workspace justify="flex-start" contentStyle={{ gap: Spacing.three }}>
      <ThemedText type="pageTitle" style={{ marginTop: clearance.top }}>
        {t('messages.title')}
      </ThemedText>

      <ThemedView style={styles.newButtonWrap}>
        <Button onPress={() => router.push('/messages/new')} variant="filled">
          <ThemedText type="small">{t('messages.newMessage')}</ThemedText>
        </Button>
      </ThemedView>

      {phase === 'loading' && <MessagesSkeleton />}

      {phase === 'error' && (
        <ThemedView style={styles.errorBlock}>
          <ThemedText type="small" themeColor="danger">
            ❌ {error}
          </ThemedText>
          <Pressable onPress={handleRetry}>
            <ThemedText type="linkPrimary">{t('common.retry')}</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {phase === 'ready' &&
        (conversations.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('messages.emptyConversations')}
          </ThemedText>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(entry) => entry.conversation.id}
            contentContainerStyle={[styles.list, { paddingBottom: clearance.bottom }]}
            renderItem={({ item }) =>
              user?.id ? (
                <ConversationRow
                  entry={item}
                  currentUserId={user.id}
                  unread={isUnreadEntry(item, user.id, readMarkers)}
                  onPress={() => router.push(`/messages/${item.conversation.id}`)}
                  onLongPress={() => openDeleteDialog(item)}
                />
              ) : null
            }
          />
        ))}

      {deleteError && (
        <ThemedText type="small" themeColor="danger">
          ❌ {deleteError}
        </ThemedText>
      )}

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={t('messages.deleteChatTitle')}
        message={
          alsoForOther
            ? t('messages.deleteChatBodyBoth')
            : t('messages.deleteChatBodyMe')
        }
        confirmLabel={t('common.delete')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
        confirming={deleting}
        option={{
          label: t('messages.deleteChatAlsoFor', {
            name: pendingDelete?.otherProfile?.username ?? t('messages.unknownUser'),
          }),
          checked: alsoForOther,
          onToggle: () => setAlsoForOther((value) => !value),
        }}
      />
    </Workspace>
  );
}

const styles = StyleSheet.create({
  newButtonWrap: {
    backgroundColor: 'transparent',
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  list: {
    gap: Spacing.two,
  },
});
