import { Modal, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Disables both buttons and swaps `confirmLabel` for a `…` placeholder
   * while the confirmed action's own request is in flight — callers pass
   * their existing `submittingIds`-derived boolean straight through. */
  confirming?: boolean;
}

/**
 * A themed replacement for `Alert.alert`/`window.confirm` — those render
 * as the OS/browser's own unstyled system dialog, which reads as visibly
 * foreign against this app's own design language (confirmed live, on
 * request, for the Friends "Remove friend" flow). `Modal` + a backdrop
 * `Pressable` (tap-outside dismisses, same as tapping Cancel) instead of
 * a native alert, styled with the same elevated-surface language
 * `ProgramCard`/`UserCard` already established (Sprint 45/46) — but using
 * the *original*, un-scaled-down Header/Navigation shadow recipe, since a
 * centered modal (unlike a list row) has generous open space around it on
 * every side, the exact case that shadow was sized for.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  confirming = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  // Mounts/unmounts the whole `Modal` rather than toggling its own
  // `visible` prop — confirmed live that react-native-web doesn't
  // actually hide (or re-hide) a `Modal`'s content on `visible={false}`,
  // so a Cancel tap correctly cleared the caller's state underneath but
  // left the dialog's last-rendered frame stuck on screen. Unmounting
  // sidesteps that prop entirely instead of depending on it.
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Swallows the tap so it doesn't bubble to the backdrop's own
            onPress and dismiss the dialog when tapping the card itself. */}
        <Pressable onPress={(event) => event.stopPropagation()}>
          <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
              {message}
            </ThemedText>
            <ThemedView style={[styles.actions, { backgroundColor: 'transparent' }]}>
              <Button onPress={onCancel} disabled={confirming} style={styles.actionButton}>
                <ThemedText type="smallBold">{t('common.cancel')}</ThemedText>
              </Button>
              <Button
                onPress={onConfirm}
                disabled={confirming}
                style={[styles.actionButton, { borderColor: theme.danger }]}
              >
                <ThemedText type="smallBold" themeColor="danger">
                  {confirming ? '…' : confirmLabel}
                </ThemedText>
              </Button>
            </ThemedView>
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
    width: 320,
    maxWidth: '100%',
    borderRadius: Spacing.two,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
});
