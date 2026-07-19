import { Href, Link } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface ScreenHeaderProps {
  /** Text for the back/cancel affordance. Rendered as-is — callers own the
   * exact wording ("← Back to programs", "Cancel", ...) since it already
   * varies across existing screens and shouldn't be silently standardized
   * as a side effect of adopting this component. */
  backLabel?: string;
  /** Use for a static destination — renders a Link. */
  backHref?: Href;
  /** Use when leaving needs custom logic first (e.g. resetting a store) —
   * renders a Pressable instead of a Link. */
  onBackPress?: () => void;
  title?: string;
  /** Right-side slot, e.g. a future action button. Unused by every screen
   * migrated so far, kept for screens that need it later without another
   * pass over this component. */
  right?: ReactNode;
}

export function ScreenHeader({
  backLabel,
  backHref,
  onBackPress,
  title,
  right,
}: ScreenHeaderProps) {
  const backText = backLabel ? <ThemedText type="linkPrimary">{backLabel}</ThemedText> : null;

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBackPress ? (
          <Pressable onPress={onBackPress}>{backText}</Pressable>
        ) : backHref ? (
          <Link href={backHref}>{backText}</Link>
        ) : null}
      </View>

      {title ? (
        <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
      ) : null}

      <View style={[styles.side, styles.rightSide]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  side: {
    flexShrink: 0,
  },
  rightSide: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
});
