import { usePathname, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface NavItem {
  label: string;
  href: Href;
  isActive: (pathname: string) => boolean;
}

const ITEMS: NavItem[] = [
  { label: 'Profile', href: '/profile', isActive: (pathname) => pathname === '/profile' },
  { label: 'Training', href: '/programs', isActive: (pathname) => pathname.startsWith('/programs') },
  { label: 'Users', href: '/users', isActive: (pathname) => pathname === '/users' },
];

// Corresponds to web's navigation.tsx/navigation.module.scss, mobile-width
// rules (`@media max-width:768px`/`max-width:460px` — the only ones
// relevant, since every RN viewport falls in that range): space-around
// row, 100px-min pills, 4px/12px padding. The active pill drops its own
// bottom border rather than getting a distinct fill — it visually opens
// into the content box directly beneath it, which shares the same border
// color, the same "folder tab" merge web's CSS produces via `.content`'s
// `margin-top:-2px`.
export function Navigation() {
  const theme = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={styles.row}>
      {ITEMS.map((item) => {
        const active = item.isActive(pathname);
        return (
          <Pressable
            key={item.label}
            style={[
              styles.pill,
              { borderColor: theme.border },
              active && { borderBottomColor: 'transparent', backgroundColor: theme.workspace },
            ]}
            onPress={() => router.push(item.href)}
          >
            <View style={styles.labelWrap}>
              <ThemedText style={[styles.label, { color: active ? theme.text : theme.title }]}>
                {item.label}
              </ThemedText>
              <View
                style={[
                  styles.underline,
                  { backgroundColor: theme.border, width: active ? '105%' : 0 },
                ]}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    gap: Spacing.one,
  },
  pill: {
    minWidth: 100,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderWidth: 2,
    borderTopLeftRadius: Spacing.one,
    borderTopRightRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    alignItems: 'center',
  },
  label: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 1,
  },
  underline: {
    position: 'absolute',
    left: '50%',
    bottom: -4,
    height: 2,
    transform: [{ translateX: '-50%' }],
  },
});
