import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

interface FullscreenImageProps {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

// Tap anywhere (backdrop or the photo itself) to dismiss -- matches the
// close-on-backdrop-click web viewer, minus a separate close button
// since the whole screen already doubles as one here.
export function FullscreenImage({ visible, uri, onClose }: FullscreenImageProps) {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Image source={{ uri }} style={styles.image} contentFit="contain" />
        <Pressable style={styles.close} onPress={onClose} hitSlop={12}>
          <ThemedText style={styles.closeText}>✕</ThemedText>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '92%',
    height: '80%',
  },
  close: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
  },
});
