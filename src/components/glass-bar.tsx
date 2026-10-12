import { BlurView } from 'expo-blur';
import { type PropsWithChildren, type RefObject } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

interface GlassBarProps extends PropsWithChildren {
  scheme: 'light' | 'dark';
  blurTarget?: RefObject<View | null>;
  style?: StyleProp<ViewStyle>;
}

// How opaque the scrim sitting between the blur and this bar's own content
// is, in `theme.background`'s tone — see this file's own doc comment for
// why it exists at all. Tuned live against the two worst cases on hand (a
// dark profile-avatar photo under Header, a dark screenshot thumbnail
// under bottom Navigation): low enough that the bar still clearly reads as
// translucent glass over light/ordinary content (the common case), high
// enough that `theme.text` icons/wordmark stay legible over near-black
// content (the rare, previously-broken case).
const SCRIM_OPACITY = 0.55;

/**
 * The shared frosted-glass bar every floating native chrome (Header,
 * Navigation, TrainingSubNav, HomeSubNav, FriendsSubNav) renders through —
 * extracted here so the one real contrast bug this shape has ever had only
 * needs fixing in one place, not five independently-drifting copies (the
 * exact failure mode this app's own history keeps running into whenever a
 * shared visual piece gets duplicated instead).
 *
 * Blur alone (expo-blur's own `tint`) isn't a strong enough wash to
 * guarantee contrast for this bar's fixed-color icons/text against
 * *everything* that can scroll behind it -- a sufficiently dark photo (a
 * news thumbnail, a workout photo) scrolled underneath let enough of its
 * own color through that `theme.text` icons and the COREFIT wordmark
 * became close to unreadable against it (confirmed via the user's own
 * screenshots). A fully opaque background would fix that outright but
 * defeats the glass effect this bar is built around, and contradicts
 * `glassBorder`'s own documented "blur alone separates the glass from
 * content, not a color overlay" decision -- instead, a translucent scrim
 * in `theme`'s own background tone sits between the blur and the content,
 * giving a guaranteed contrast floor against *any* backdrop while still
 * reading as glass, not a solid bar, over the ordinary (light) content
 * this previously worked fine against.
 */
export function GlassBar({ scheme, blurTarget, style, children }: GlassBarProps) {
  const theme = useTheme();

  return (
    <BlurView
      intensity={45}
      tint={scheme === 'dark' ? 'dark' : 'light'}
      blurMethod="dimezisBlurViewSdk31Plus"
      blurTarget={blurTarget}
      style={style}
    >
      <View
        style={[styles.scrim, { backgroundColor: theme.background, opacity: SCRIM_OPACITY }]}
        pointerEvents="none"
      />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  scrim: StyleSheet.absoluteFill,
});
