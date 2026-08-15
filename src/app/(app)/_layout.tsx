import { Stack } from 'expo-router';

import { AppShell } from '@/components/app-shell';

export default function AppLayout() {
  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="programs" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="messages" />
      </Stack>
    </AppShell>
  );
}
