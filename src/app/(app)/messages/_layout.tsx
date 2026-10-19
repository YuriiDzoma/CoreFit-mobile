import { Stack } from 'expo-router';

// No floating sub-nav here (unlike profile/_layout.tsx or
// programs/_layout.tsx) -- Messages has no secondary tab bar, just the
// conversation list, the new-message picker, and the chat thread, all
// under the global Header/Navigation.
export default function MessagesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
