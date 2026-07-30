import { MessageSquareText } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';
import { useChromeClearance } from '@/hooks/use-chrome-clearance';
import { useTheme } from '@/hooks/use-theme';

/** Placeholder for the not-yet-built Messages feature — the nav item exists
 * now so the primary bar's shape doesn't change again once messaging ships. */
export default function MessagesScreen() {
  const theme = useTheme();
  const clearance = useChromeClearance();

  return (
    <Workspace
      contentStyle={{
        alignItems: 'center',
        gap: Spacing.three,
        paddingTop: clearance.top,
        paddingBottom: clearance.bottom,
      }}
    >
      <MessageSquareText size={40} color={theme.textSecondary} strokeWidth={1.5} />
      <ThemedText type="subtitle">Messages</ThemedText>
      <ThemedText style={{ color: theme.textSecondary, textAlign: 'center' }}>
        Coming soon — you&apos;ll be able to message friends directly from here.
      </ThemedText>
    </Workspace>
  );
}
