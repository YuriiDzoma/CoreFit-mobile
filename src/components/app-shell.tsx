import { BlurTargetView } from 'expo-blur';
import { useRef, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/header';
import { Navigation } from '@/components/navigation';
import { ThemedView } from '@/components/themed-view';

/**
 * Root shell chrome, mounted once around every screen under `(app)` —
 * mirrors web's `AppShell.tsx`: `Header` and `Navigation` are siblings of
 * routed page content, not nested inside it.
 *
 * `Header` and `Navigation` are self-positioning floating bars (their own
 * `position: absolute`, sized off safe-area insets). This component adds
 * no clearance padding of its own — `{children}` is fully unconstrained
 * (plain `flex: 1`), so any scrolling content inside it can genuinely
 * extend the full screen height and pass behind both bars. Clearance is
 * the job of whatever actually scrolls (see `use-chrome-clearance.ts` and
 * `workspace.tsx`), not this component — padding here would just re-shrink
 * every scrolling descendant's frame, the exact bug this replaces.
 *
 * `{children}` is wrapped in a `BlurTargetView` (a plain `View` everywhere
 * except Android) rather than a bare `View`, and that ref is handed to
 * both `Header` and `Navigation`'s `BlurView`s as `blurTarget` — on
 * Android, `expo-blur` only renders a flat tint unless it's told exactly
 * which view's content to actually blur; iOS blurs correctly without any
 * of this (native `UIVisualEffectView`), so this is additive there, not
 * required.
 */
export function AppShell({ children }: PropsWithChildren) {
  const blurTarget = useRef<View>(null);

  return (
    <ThemedView type="workspace" style={styles.fill}>
      <BlurTargetView ref={blurTarget} style={styles.fill}>
        {children}
      </BlurTargetView>

      <Header blurTarget={blurTarget} />
      <Navigation blurTarget={blurTarget} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
