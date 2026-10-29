import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatBubbleTime } from '@/lib/formatMessageTime';
import { type Message } from '@/lib/supabase/messages';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  /** Opens the delete menu (Sprint 119) — long press, as in Telegram/Viber. */
  onLongPress?: () => void;
}

/**
 * One chat bubble. "Our colors", not a new brand accent: the own-message
 * fill is `theme.border` (`#204879`), the same navy used everywhere else
 * in this app as its signature accent (floating-bar active states,
 * outlined buttons) — filling it in here gives the own/other contrast
 * Telegram's blue-vs-grey bubbles have, without inventing a color this
 * app doesn't already use elsewhere. The other participant's bubble reuses
 * `elevatedBg`, the same "lifted surface" tone `ElevatedCard` uses
 * throughout the rest of the app.
 */
export function MessageBubble({ message, isOwn, onLongPress }: MessageBubbleProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => [
          styles.bubble,
          pressed && onLongPress && styles.pressed,
          Platform.OS === 'web' && styles.noWebCallout,
          isOwn
            ? [styles.bubbleOwn, { backgroundColor: theme.border }]
            : [styles.bubbleOther, { backgroundColor: theme.elevatedBg }],
        ]}
      >
        <ThemedText style={isOwn ? styles.textOwn : undefined}>{message.body}</ThemedText>
        <ThemedText
          type="small"
          style={[styles.time, isOwn ? styles.timeOwn : { color: theme.textSecondary }]}
        >
          {formatBubbleTime(message.created_at)}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  // A flattened corner on the side nearest the screen edge -- the one
  // small "tail" cue that reads as a bubble rather than a plain rounded
  // rectangle, without actually drawing a pointed tail shape.
  bubbleOwn: {
    borderBottomRightRadius: Spacing.half,
  },
  bubbleOther: {
    borderBottomLeftRadius: Spacing.half,
  },
  pressed: {
    opacity: 0.8,
  },
  // Mobile Safari otherwise answers a long press with its own text-
  // selection/callout menu before ours can open.
  noWebCallout: {
    userSelect: 'none',
    // @ts-expect-error -- web-only CSS property, not in RN's style types
    WebkitTouchCallout: 'none',
  },
  textOwn: {
    color: '#fff',
  },
  time: {
    alignSelf: 'flex-end',
    fontSize: 11,
    lineHeight: 14,
  },
  timeOwn: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
