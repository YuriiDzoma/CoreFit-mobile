import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AuthTextFieldProps = TextInputProps & {
  label: string;
  errorMessage?: string;
  /** Settings restyles the label to web's InputBox; auth screens don't. */
  labelStyle?: StyleProp<TextStyle>;
};

export function AuthTextField({
  label,
  errorMessage,
  labelStyle,
  style,
  ...rest
}: AuthTextFieldProps) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="small" style={labelStyle}>
        {label}
      </ThemedText>
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
