import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

interface AvatarProps {
  uri?: string | null;
  /** Source for the fallback initial (username, or an email as a
   * secondary source) — not rendered as text anywhere else. */
  name?: string | null;
  size: number;
  /** Overrides the default circular shape (`size / 2`). Web isn't
   * consistent about avatar shape across pages — Profile.client.tsx's
   * own avatar is a 4px-radius square (`profiles.module.scss`), not
   * circular like Home's feed — so this is additive, not a change to
   * the existing default every other call site already relies on. */
  radius?: number;
}

function initialFrom(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

/**
 * Renders an image when `uri` is present, otherwise a themed circular
 * fallback with the first letter of `name`. Owns only this rendering —
 * layout direction, adjacent text, and press handling are the caller's
 * responsibility (see `profile/index.tsx`'s vertical header vs. the Home
 * feed's horizontal row for two different surrounding layouts).
 */
export function Avatar({ uri, name, size, radius }: AvatarProps) {
  const circleStyle = { width: size, height: size, borderRadius: radius ?? size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={circleStyle} contentFit="cover" />;
  }

  return (
    <ThemedView type="backgroundElement" style={[styles.fallback, circleStyle]}>
      <ThemedText style={{ fontSize: size * 0.375, lineHeight: size * 0.42, fontWeight: '700' }}>
        {initialFrom(name)}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
