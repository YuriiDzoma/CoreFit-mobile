import { Check, CheckCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ElevatedCard } from '@/components/elevated-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatConversationTime } from '@/lib/formatMessageTime';
import { formatLastActive } from '@/lib/lastActive';
import { isReadByPeer } from '@/lib/supabase/messages';
import { type ConversationWithProfile } from '@/stores/messages-store';

interface ConversationRowProps {
  entry: ConversationWithProfile;
  currentUserId: string;
  /** Unread messages from the other participant -- a red count pill. */
  unreadCount: number;
  /** The other participant's read marker: ticks when the last message is
   * mine. */
  peerReadAt?: string;
  onPress: () => void;
  /** Opens the delete-chat dialog (Sprint 119). */
  onLongPress?: () => void;
}

/** One row in the Messages conversation list — avatar, other participant's
 * name, a one-line preview of the last message (prefixed "Ви: " when it
 * was this user's own), a timestamp with ticks when the last message is
 * mine, and a red unread-count pill. Deliberately its
 * own component rather than a `UserCard` variant: the two-line text
 * column + trailing meta column (time + dot, not a chevron/action) is a
 * different enough shape that reusing `UserCard` would mean fighting its
 * single-line layout rather than extending it.
 *
 * Sized to web's conversationList.module.scss: an elevated card with 8px
 * padding, 48px avatar 12px from the text, 15px bold name, 14px preview
 * at 80% and a 12px time at 70%, both in the title color. */
export function ConversationRow({
  entry,
  currentUserId,
  unreadCount,
  peerReadAt,
  onPress,
  onLongPress,
}: ConversationRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { conversation, otherProfile } = entry;
  const name = otherProfile?.username ?? t('messages.unknownUser');
  const isOnline = formatLastActive(otherProfile?.last_active_at ?? null)?.isOnline ?? false;

  const lastIsMine =
    !!conversation.last_message_at && conversation.last_message_sender_id === currentUserId;
  const lastRead = lastIsMine && isReadByPeer(conversation.last_message_at as string, peerReadAt);

  const preview = conversation.last_message_body
    ? conversation.last_message_sender_id === currentUserId
      ? t('messages.previewFromYou', { body: conversation.last_message_body })
      : conversation.last_message_body
    : t('messages.noMessagesPreview');

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350}>
      <ElevatedCard style={styles.row}>
        <View>
          <Avatar uri={otherProfile?.avatar_url} name={otherProfile?.username} size={48} />
          {isOnline && (
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: theme.success, borderColor: theme.elevatedBg },
              ]}
            />
          )}
        </View>
        <View style={styles.textCol}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText style={styles.preview} themeColor="title" numberOfLines={1}>
            {preview}
          </ThemedText>
        </View>
        <View style={styles.metaCol}>
          {conversation.last_message_at && (
            <View style={styles.timeRow}>
              {lastIsMine &&
                (lastRead ? (
                  <CheckCheck size={14} color={theme.success} strokeWidth={2.4} />
                ) : (
                  <Check size={14} color={theme.title} strokeWidth={2.4} />
                ))}
              <ThemedText style={styles.time} themeColor="title">
                {formatConversationTime(conversation.last_message_at)}
              </ThemedText>
            </View>
          )}
          {unreadCount > 0 && (
            <View style={[styles.unreadPill, { backgroundColor: theme.danger }]}>
              <ThemedText style={styles.unreadText}>
                {unreadCount > 99 ? '99+' : String(unreadCount)}
              </ThemedText>
            </View>
          )}
        </View>
      </ElevatedCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.two,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: 700,
  },
  preview: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: 400,
    opacity: 0.8,
  },
  time: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: 400,
    opacity: 0.7,
  },
  metaCol: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  // Same green dot as UserCard's online indicator, ringed in the row color.
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  // Telegram-style count: a pill that grows with the digits.
  unreadPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: 700,
  },
});
