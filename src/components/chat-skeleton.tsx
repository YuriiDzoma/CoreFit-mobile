import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Alternating sides and uneven widths so it reads as a conversation, not a
// list; newest at the bottom like the real inverted thread.
const BUBBLES: { own: boolean; width: `${number}%`; height: number }[] = [
  { own: false, width: '55%', height: 44 },
  { own: true, width: '40%', height: 44 },
  { own: false, width: '68%', height: 64 },
  { own: true, width: '50%', height: 44 },
  { own: true, width: '30%', height: 44 },
];

/** Placeholder for the conversation screen while it loads -- same three
 * parts as `messages/[id].tsx`: the contact row (36px avatar, name and
 * last-seen lines), message bubbles, and the input row. On a slow
 * connection the screen used to stay blank, which read as an empty chat. */
export function ChatSkeleton({ top, bottom }: { top: number; bottom: number }) {
  const theme = useTheme();
  const bg = { backgroundColor: theme.skeletonBg };

  return (
    <View style={styles.fill}>
      <View style={[styles.contactRow, { paddingTop: top, borderColor: theme.border }]}>
        <View style={[styles.avatar, bg]} />
        <View style={styles.contactText}>
          <View style={[styles.nameLine, bg]} />
          <View style={[styles.statusLine, bg]} />
        </View>
      </View>

      <View style={styles.messages}>
        {BUBBLES.map((bubble, index) => (
          <View key={index} style={[styles.row, bubble.own ? styles.rowOwn : styles.rowOther]}>
            <View
              style={[
                styles.bubble,
                bubble.own ? styles.bubbleOwn : styles.bubbleOther,
                { width: bubble.width, height: bubble.height },
                bg,
              ]}
            />
          </View>
        ))}
      </View>

      <View style={[styles.inputRow, { paddingBottom: bottom, borderColor: theme.border }]}>
        <View style={[styles.input, bg]} />
        <View style={[styles.sendButton, bg]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  contactText: {
    gap: 6,
  },
  nameLine: {
    width: 120,
    height: 14,
    borderRadius: 4,
  },
  statusLine: {
    width: 70,
    height: 12,
    borderRadius: 4,
  },
  messages: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
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
  // Same radii and flattened corner as MessageBubble.
  bubble: {
    borderRadius: Spacing.three,
  },
  bubbleOwn: {
    borderBottomRightRadius: Spacing.half,
  },
  bubbleOther: {
    borderBottomLeftRadius: Spacing.half,
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
    height: 40,
    borderRadius: Spacing.three,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
