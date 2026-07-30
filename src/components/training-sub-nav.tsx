import { usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SubNavItem {
  label: string;
  href: Href;
  isActive: (pathname: string) => boolean;
}

const ITEMS: SubNavItem[] = [
  {
    label: 'Complexes',
    href: '/programs/complexes',
    isActive: (pathname) => pathname.startsWith('/programs/complexes'),
  },
  {
    label: 'Programs',
    href: '/programs',
    isActive: (pathname) =>
      !pathname.startsWith('/programs/complexes') && !pathname.startsWith('/programs/wiki'),
  },
  {
    label: 'Wiki',
    href: '/programs/wiki',
    isActive: (pathname) => pathname.startsWith('/programs/wiki'),
  },
];

export const TRAINING_SUB_NAV_HEIGHT = 38;

// Corresponds to web's trainingMenu.tsx/trainingMenu.module.scss: rendered
// in normal flow directly below the Header, only inside Training's own
// routes — same three-way split web's own isActive logic uses (Programs is
// the fallback when neither Complexes nor Wiki match). Web's active
// indicator is an elaborate border-trick chevron under the label;
// reproduced here using the same active language as the primary
// `Navigation` bar (filled fill + label color swap) for one consistent
// visual vocabulary rather than a second, different active-state mechanism.
export function TrainingSubNav() {
  const theme = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={[styles.row, { borderColor: theme.workspace, backgroundColor: theme.workspace }]}>
      {ITEMS.map((item) => {
        const active = item.isActive(pathname);
        return (
          <Pressable
            key={item.label}
            style={[
              styles.pill,
              { borderColor: theme.border },
              active && { backgroundColor: theme.backgroundSelected },
            ]}
            onPress={() => router.push(item.href)}
          >
            <ThemedText style={[styles.label, { color: active ? theme.text : theme.title }]}>
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: Spacing.two,
    marginBottom: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: Spacing.one,
    height: TRAINING_SUB_NAV_HEIGHT,
  },
  pill: {
    minWidth: 100,
    height: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 18,
  },
});
