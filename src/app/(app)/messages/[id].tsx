import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ActionSheet, type ActionSheetItem } from '@/components/action-sheet';
import { Avatar } from '@/components/avatar';
import { MessageBubble } from '@/components/message-bubble';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';
import { useTheme } from '@/hooks/use-theme';
import { formatDateDivider } from '@/lib/formatMessageTime';
import { formatLastActive } from '@/lib/lastActive';
import {
  deleteMessageForEveryone,
  editMessage,
  getConversationById,
  getMessages,
  hideMessageForMe,
  markConversationRead,
  messageSchema,
  otherParticipantId,
  sendMessage,
  type Conversation,
  type Message,
} from '@/lib/supabase/messages';
import { getProfileById, type Profile } from '@/lib/supabase/profile';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { useMessagesStore } from '@/stores/messages-store';

type LoadState =
  | { state: 'loading' }
  | { state: 'success'; conversation: Conversation; otherProfile: Profile | null }
  | { state: 'not-found' }
  | { state: 'error'; message: string };

type ChatListItem =
  { kind: 'message'; message: Message } | { kind: 'divider'; label: string; key: string };

/** Walks the newest-first message array (matching the inverted `FlatList`'s
 * own order) and inserts one date divider right after the last message of
 * each calendar day — i.e. visually *above* that day's messages once the
 * list is flipped upright by `inverted`. */
function withDateDividers(messages: Message[]): ChatListItem[] {
  const items: ChatListItem[] = [];
  messages.forEach((message, index) => {
    items.push({ kind: 'message', message });
    const next = messages[index + 1];
    const sameDayAsNext =
      next &&
      new Date(next.created_at).toDateString() === new Date(message.created_at).toDateString();
    if (!sameDayAsNext) {
      items.push({
        kind: 'divider',
        label: formatDateDivider(message.created_at),
        key: `divider-${message.id}`,
      });
    }
  });
  return items;
}

export default function ConversationScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const clearance = useChromeClearance();
  const userId = useAuthStore((state) => state.user?.id);
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loadState, setLoadState] = useState<LoadState>({ state: 'loading' });
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Telegram-style edit mode: the input holds the message's text and Send
  // saves it in place instead of posting a new one.
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  const markRead = useCallback(() => {
    if (!conversationId || !userId) return;
    markConversationRead(conversationId, userId)
      .then(() => useMessagesStore.getState().markRead(conversationId, userId))
      .catch(() => {});
  }, [conversationId, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!conversationId || !userId) return;
      let cancelled = false;

      setLoadState({ state: 'loading' });
      Promise.all([getConversationById(conversationId), getMessages(conversationId)])
        .then(async ([conversation, page]) => {
          if (cancelled) return;
          const otherId = otherParticipantId(conversation, userId);
          const otherProfile = await getProfileById(otherId).catch(() => null);
          if (cancelled) return;
          setLoadState({ state: 'success', conversation, otherProfile });
          setMessages(page);
          setHasMore(page.length === 30);
          markRead();
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          const message =
            (error as { code?: string }).code === 'PGRST116' ? null : (error as Error).message;
          setLoadState(message ? { state: 'error', message } : { state: 'not-found' });
        });

      const channel = supabase
        .channel(`conversation:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const parsed = messageSchema.safeParse(payload.new);
            if (!parsed.success) return;
            setMessages((prev) =>
              prev.some((m) => m.id === parsed.data.id) ? prev : [parsed.data, ...prev],
            );
            if (parsed.data.sender_id !== userId) markRead();
          },
        )
        // An edit (either side): swap the row in place. UPDATE payloads
        // carry the full new row and are filterable like INSERT.
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const parsed = messageSchema.safeParse(payload.new);
            if (!parsed.success) return;
            setMessages((prev) => prev.map((m) => (m.id === parsed.data.id ? parsed.data : m)));
          },
        )
        // The other participant's "delete for everyone". DELETE events
        // can't be filtered server-side and carry only the id, so they're
        // matched against what's loaded here.
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'messages' },
          (payload) => {
            const deletedId = (payload.old as { id?: string }).id;
            if (deletedId) setMessages((prev) => prev.filter((m) => m.id !== deletedId));
          },
        )
        // The other participant deleted the whole chat for both.
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'conversations' },
          (payload) => {
            if ((payload.old as { id?: string }).id !== conversationId) return;
            useMessagesStore.getState().removeConversation(conversationId);
            setLoadState({ state: 'not-found' });
          },
        )
        .subscribe();
      channelRef.current = channel;

      return () => {
        cancelled = true;
        supabase.removeChannel(channel);
        channelRef.current = null;
      };
    }, [conversationId, userId, markRead]),
  );

  const handleLoadMore = () => {
    if (!conversationId || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[messages.length - 1];
    getMessages(conversationId, oldest.created_at)
      .then((page) => {
        setMessages((prev) => [...prev, ...page]);
        setHasMore(page.length === 30);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const exitEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  const handleSend = () => {
    const body = inputText.trim();
    if (!body || !conversationId || !userId || sending) return;
    if (editingMessage) {
      if (body === editingMessage.body) {
        exitEdit();
        return;
      }
      setSending(true);
      setSendError(null);
      editMessage(editingMessage.id, body)
        .then((updated) => {
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          exitEdit();
        })
        .catch((error: Error) => setSendError(error.message))
        .finally(() => setSending(false));
      return;
    }
    setSending(true);
    setSendError(null);
    sendMessage(conversationId, userId, body)
      .then((message) => {
        setInputText('');
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [message, ...prev]));
      })
      .catch((error: Error) => setSendError(error.message))
      .finally(() => setSending(false));
  };

  const closeActions = () => {
    setActionMessage(null);
    setActionError(null);
  };

  // Removed locally first-hand on success; for "for everyone" the realtime
  // DELETE echo is then a no-op filter.
  const runMessageAction = (action: (message: Message) => Promise<void>) => {
    const target = actionMessage;
    if (!target) return;
    setActionError(null);
    action(target)
      .then(() => {
        setMessages((prev) => prev.filter((m) => m.id !== target.id));
        if (editingMessage?.id === target.id) exitEdit();
        closeActions();
      })
      .catch((error: Error) => setActionError(`❌ ${error.message}`));
  };

  const actionItems: ActionSheetItem[] = [];
  if (actionMessage && userId) {
    if (actionMessage.sender_id === userId) {
      const target = actionMessage;
      actionItems.push({
        key: 'edit',
        label: t('messages.edit'),
        onPress: () => {
          setEditingMessage(target);
          setInputText(target.body);
          closeActions();
        },
      });
      actionItems.push({
        key: 'everyone',
        label: t('messages.deleteForEveryone'),
        destructive: true,
        onPress: () => runMessageAction((m) => deleteMessageForEveryone(m.id)),
      });
    }
    actionItems.push(
      {
        key: 'me',
        label: t('messages.deleteForMe'),
        destructive: true,
        onPress: () => runMessageAction((m) => hideMessageForMe(m.id, userId)),
      },
      { key: 'cancel', label: t('common.cancel'), onPress: closeActions },
    );
  }

  if (loadState.state === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView type="workspace" style={styles.fill} />
      </SafeAreaView>
    );
  }

  if (loadState.state === 'not-found' || loadState.state === 'error') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView
          type="workspace"
          style={[styles.fill, styles.centered, { paddingTop: clearance.top }]}
        >
          <ThemedText type="small" themeColor="danger">
            {loadState.state === 'not-found' ? t('messages.notFound') : `❌ ${loadState.message}`}
          </ThemedText>
          {loadState.state === 'not-found' && (
            <Pressable onPress={() => router.replace('/messages')}>
              <ThemedText type="linkPrimary">{t('messages.backToList')}</ThemedText>
            </Pressable>
          )}
        </ThemedView>
      </SafeAreaView>
    );
  }

  const { otherProfile } = loadState;
  const name = otherProfile?.username ?? t('messages.unknownUser');
  const lastActive = formatLastActive(otherProfile?.last_active_at ?? null);
  const listData = withDateDividers(messages);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ThemedView type="workspace" style={styles.fill}>
        <KeyboardAvoidingView
          style={styles.fill}
          // Android's `windowSoftInputMode="adjustResize"` (AndroidManifest.xml)
          // is the normal way to let the OS itself shrink the window and
          // push content up -- but with this app's edge-to-edge display
          // enabled (RN's modern default on Android 15+), that resize
          // doesn't reliably propagate to the RN root view the way it did
          // pre-edge-to-edge, confirmed live (the input row ended up
          // entirely hidden behind the keyboard). `'height'` sidesteps
          // that by having KeyboardAvoidingView itself shrink its content
          // height on keyboard show, rather than depending on the native
          // window resize at all.
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? clearance.top : 0}
        >
          <View
            style={[styles.contactRow, { paddingTop: clearance.top, borderColor: theme.border }]}
          >
            <View>
              <Avatar uri={otherProfile?.avatar_url} name={otherProfile?.username} size={36} />
              {lastActive?.isOnline && (
                <View
                  style={[
                    styles.onlineDot,
                    { backgroundColor: theme.success, borderColor: theme.background },
                  ]}
                />
              )}
            </View>
            <View style={styles.contactTextCol}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {name}
              </ThemedText>
              {lastActive && (
                <ThemedText
                  type="small"
                  themeColor={lastActive.isOnline ? 'success' : 'textSecondary'}
                  numberOfLines={1}
                >
                  {lastActive.text}
                </ThemedText>
              )}
            </View>
          </View>

          {messages.length === 0 ? (
            <View style={[styles.fill, styles.centered]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('messages.noMessagesYet')}
              </ThemedText>
            </View>
          ) : (
            <FlatList
              style={styles.fill}
              inverted
              data={listData}
              keyExtractor={(item) => (item.kind === 'message' ? item.message.id : item.key)}
              contentContainerStyle={styles.messagesContent}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.4}
              renderItem={({ item }) =>
                item.kind === 'divider' ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.divider}>
                    {item.label}
                  </ThemedText>
                ) : (
                  <MessageBubble
                    message={item.message}
                    isOwn={item.message.sender_id === userId}
                    onLongPress={() => setActionMessage(item.message)}
                  />
                )
              }
            />
          )}

          {sendError && (
            <ThemedText type="small" themeColor="danger" style={styles.sendError}>
              ❌ {sendError}
            </ThemedText>
          )}

          {editingMessage && (
            <View style={[styles.editBanner, { borderColor: theme.border }]}>
              <SymbolView
                name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                size={18}
                tintColor={theme.text}
              />
              <View style={styles.editBannerText}>
                <ThemedText type="smallBold">{t('messages.editing')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {editingMessage.body}
                </ThemedText>
              </View>
              <Pressable
                onPress={exitEdit}
                hitSlop={Spacing.two}
                accessibilityLabel={t('messages.cancelEdit')}
              >
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={18}
                  tintColor={theme.textSecondary}
                />
              </Pressable>
            </View>
          )}

          <View
            style={[
              styles.inputRow,
              { borderColor: theme.border, paddingBottom: clearance.bottom },
            ]}
          >
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('messages.inputPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.backgroundElement },
              ]}
              multiline
              maxLength={2000}
            />
            <Pressable
              onPress={handleSend}
              disabled={sending || inputText.trim().length === 0}
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: theme.border },
                (sending || inputText.trim().length === 0) && styles.sendButtonDisabled,
                pressed && styles.sendButtonPressed,
              ]}
            >
              <SymbolView
                name={
                  editingMessage
                    ? { ios: 'checkmark', android: 'check', web: 'check' }
                    : { ios: 'paperplane.fill', android: 'send', web: 'send' }
                }
                size={18}
                tintColor="#fff"
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </ThemedView>
      <ActionSheet
        visible={actionMessage !== null}
        items={actionItems}
        error={actionError}
        onClose={closeActions}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same green dot as UserCard's online indicator, ringed in the page color.
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
  },
  contactTextCol: {
    flex: 1,
    gap: 2,
  },
  messagesContent: {
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  divider: {
    textAlign: 'center',
    paddingVertical: Spacing.one,
  },
  sendError: {
    textAlign: 'center',
    paddingVertical: Spacing.one,
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
  },
  editBannerText: {
    flex: 1,
    gap: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonPressed: {
    opacity: 0.7,
  },
});
