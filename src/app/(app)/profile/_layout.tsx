import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="users" />
    </Stack>
  );
}
