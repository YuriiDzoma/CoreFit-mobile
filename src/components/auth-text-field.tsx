import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AuthTextFieldProps = TextInputProps & {
  label: string;
  errorMessage?: string;
};

export function AuthTextField({ label, errorMessage, style, ...rest }: AuthTextFieldProps) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="small">{label}</ThemedText>
      <TextInput
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: 'transparent',
            borderColor: errorMessage ? theme.danger : theme.border,
          },
          style,
        ]}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      {errorMessage ? (
        <ThemedText type="small" themeColor="danger">
          {errorMessage}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 40,
    borderWidth: 2,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
});
