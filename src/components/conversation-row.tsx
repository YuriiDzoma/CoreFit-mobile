import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ElevatedCard } from '@/components/elevated-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatConversationTime } from '@/lib/formatMessageTime';
import { formatLastActive } from '@/lib/lastActive';
import { type ConversationWithProfile } from '@/stores/messages-store';

interface ConversationRowProps {
  entry: ConversationWithProfile;
  currentUserId: string;
  unread: boolean;
  onPress: () => void;
  /** Opens the delete-chat dialog (Sprint 119). */
  onLongPress?: () => void;
}

/** One row in the Messages conversation list — avatar, other participant's
 * name, a one-line preview of the last message (prefixed "Ви: " when it
 * was this user's own), a timestamp, and an unread dot. Deliberately its
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
  unread,
  onPress,
  onLongPress,
}: ConversationRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { conversation, otherProfile } = entry;
  const name = otherProfile?.username ?? t('messages.unknownUser');
  const isOnline = formatLastActive(otherProfile?.last_active_at ?? null)?.isOnline ?? false;

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
            <ThemedText style={styles.time} themeColor="title">
              {formatConversationTime(conversation.last_message_at)}
            </ThemedText>
          )}
          {unread && <View style={[styles.unreadDot, { backgroundColor: theme.danger }]} />}
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
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
