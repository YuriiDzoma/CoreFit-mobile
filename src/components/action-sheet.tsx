import { Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ActionSheetItem {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  items: ActionSheetItem[];
  error?: string | null;
  onClose: () => void;
}

// The long-press menu (message actions, Sprint 119) — same centered card +
// backdrop shape as AvatarActionSheet/ConfirmDialog, but item-driven so the
// caller decides which actions apply (own vs. other's message). Mounts/
// unmounts instead of toggling `visible` for the same react-native-web
// reason ConfirmDialog documents.
export function ActionSheet({ visible, items, error, onClose }: ActionSheetProps) {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={(event) => event.stopPropagation()}>
          <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            {items.map((item) => (
              <Pressable key={item.key} onPress={item.onPress} style={styles.row}>
                <ThemedText type="smallBold" themeColor={item.destructive ? 'danger' : undefined}>
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
            {error && (
              <ThemedText type="small" themeColor="danger" style={styles.error}>
                {error}
              </ThemedText>
            )}
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: Spacing.four,
  },
  card: {
    width: 280,
    maxWidth: '100%',
    borderRadius: Spacing.two,
    padding: Spacing.two,
    gap: Spacing.one,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  row: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  error: {
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.one,
  },
});
