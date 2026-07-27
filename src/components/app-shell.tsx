import { type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '@/components/header';
import { Navigation } from '@/components/navigation';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Root shell chrome, mounted once around every screen under `(app)` —
 * mirrors web's `AppShell.tsx`: `Header` and `Navigation` are siblings of
 * routed page content, not nested inside it. Owns the top safe-area inset;
 * each routed screen's own `Workspace` claims the remaining three edges
 * (`topInset={false}`) and owns the bordered content box, matching web's
 * `.content` div wrapping only the page's own content.
 */
export function AppShell({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ThemedView type="workspace" style={styles.fill}>
        <View style={styles.chrome}>
          <View style={styles.headerRow}>
            <Header />
          </View>
          <View style={styles.navigationRow}>
            <Navigation />
          </View>
        </View>

        {children}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  // Same horizontal inset/max-width as Workspace's own `container` style,
  // so Header/Navigation align with the content box edges below them.
  chrome: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.two,
  },
  // `.header{margin-bottom:16px}` at web's mobile-width breakpoint — every
  // RN viewport is in that range.
  headerRow: {
    marginBottom: Spacing.three,
  },
  // Web's `.content{margin-top:-2px}` pulls the content box up to overlap
  // Navigation's own 2px border, so the active pill (its own bottom border
  // dropped) reads as merging seamlessly into the content box beneath it —
  // reproduced here on Navigation's side instead, since the content box is
  // a separate sibling (Workspace, rendered per-screen) this component
  // doesn't own.
  navigationRow: {
    zIndex: 1,
    marginBottom: -2,
  },
});
