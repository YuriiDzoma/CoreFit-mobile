import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatConversationTime } from '@/lib/formatMessageTime';
import { type ConversationWithProfile } from '@/stores/messages-store';

interface ConversationRowProps {
  entry: ConversationWithProfile;
  currentUserId: string;
  unread: boolean;
  onPress: () => void;
}

/** One row in the Messages conversation list — avatar, other participant's
 * name, a one-line preview of the last message (prefixed "Ви: " when it
 * was this user's own), a timestamp, and an unread dot. Deliberately its
 * own component rather than a `UserCard` variant: the two-line text
 * column + trailing meta column (time + dot, not a chevron/action) is a
 * different enough shape that reusing `UserCard` would mean fighting its
 * single-line layout rather than extending it. */
export function ConversationRow({ entry, currentUserId, unread, onPress }: ConversationRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { conversation, otherProfile } = entry;
  const name = otherProfile?.username ?? t('messages.unknownUser');

  const preview = conversation.last_message_body
    ? conversation.last_message_sender_id === currentUserId
      ? t('messages.previewFromYou', { body: conversation.last_message_body })
      : conversation.last_message_body
    : t('messages.noMessagesPreview');

  return (
    <Pressable onPress={onPress}>
      <ThemedView style={[styles.row, { borderColor: theme.border }]}>
        <Avatar uri={otherProfile?.avatar_url} name={otherProfile?.username} size={48} />
        <View style={styles.textCol}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {preview}
          </ThemedText>
        </View>
        <View style={styles.metaCol}>
          {conversation.last_message_at && (
            <ThemedText type="small" themeColor="textSecondary">
              {formatConversationTime(conversation.last_message_at)}
            </ThemedText>
          )}
          {unread && <View style={[styles.unreadDot, { backgroundColor: theme.danger }]} />}
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.one,
    padding: Spacing.three,
    borderWidth: 1,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  metaCol: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
