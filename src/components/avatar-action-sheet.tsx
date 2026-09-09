import { Modal, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface AvatarActionSheetProps {
  visible: boolean;
  hasPhoto: boolean;
  error: string | null;
  onView: () => void;
  onChange: () => void;
  onDelete: () => void;
  onClose: () => void;
}

// A simple centered sheet, not a pixel-anchored dropdown under the
// avatar the way web's own AvatarMenu is -- a centered/bottom action
// sheet is the idiomatic native pattern here. Same Modal + backdrop
// Pressable shape as ConfirmDialog.
export function AvatarActionSheet({
  visible,
  hasPhoto,
  error,
  onView,
  onChange,
  onDelete,
  onClose,
}: AvatarActionSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={(event) => event.stopPropagation()}>
          <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            {hasPhoto && (
              <Pressable onPress={onView} style={styles.row}>
                <ThemedText type="smallBold">{t('profile.avatar.view')}</ThemedText>
              </Pressable>
            )}
            <Pressable onPress={onChange} style={styles.row}>
              <ThemedText type="smallBold">{t('profile.avatar.change')}</ThemedText>
            </Pressable>
            {hasPhoto && (
              <Pressable onPress={onDelete} style={styles.row}>
                <ThemedText type="smallBold" themeColor="danger">
                  {t('profile.avatar.delete')}
                </ThemedText>
              </Pressable>
            )}
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
