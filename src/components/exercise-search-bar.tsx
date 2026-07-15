import { SymbolView } from 'expo-symbols';
import { Keyboard, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ExerciseSearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
};

export function ExerciseSearchBar({ value, onChangeText }: ExerciseSearchBarProps) {
  const theme = useTheme();

  return (
    <ThemedView style={[styles.searchRow, { backgroundColor: theme.backgroundElement }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search exercises"
        placeholderTextColor={theme.textSecondary}
        style={[styles.searchInput, { color: theme.text }]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => Keyboard.dismiss()}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => {
            onChangeText('');
            Keyboard.dismiss();
          }}
          style={styles.clearButton}
        >
          <SymbolView
            name={{ ios: 'xmark.circle.fill', android: 'close', web: 'close' }}
            size={18}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  clearButton: {
    paddingLeft: Spacing.two,
  },
});
