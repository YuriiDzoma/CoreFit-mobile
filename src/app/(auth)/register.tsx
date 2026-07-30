import { Link, router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { RegisterForm } from '@/components/register-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workspace } from '@/components/workspace';
import { Spacing } from '@/constants/theme';

export default function RegisterScreen() {
  return (
    <Workspace>
      <ThemedText type="title">Create account</ThemedText>

      <RegisterForm
        onRequiresConfirmation={(email) =>
          router.push({ pathname: '/confirm-email', params: { email } })
        }
      />

      <ThemedView style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          Already have an account?
        </ThemedText>
        <Link href="/login">
          <ThemedText type="linkPrimary">Sign in</ThemedText>
        </Link>
      </ThemedView>
    </Workspace>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
  },
});
