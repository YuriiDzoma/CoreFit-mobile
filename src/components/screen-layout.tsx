import { type PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * The centered, non-scrolling shell (SafeAreaView + themed container) that's
 * currently duplicated near-verbatim across the auth screens. Deliberately
 * doesn't handle scrolling — screens whose content is a ScrollView/FlatList
 * (Program Detail, Exercise Detail, Exercise Picker) have their own bespoke
 * shell already and aren't forced through this one.
 */
export function ScreenLayout({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>{children}</ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
});
