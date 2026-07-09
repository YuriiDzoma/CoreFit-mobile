import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Auth storage adapter for supabase-js. expo-secure-store has no web
 * implementation, so web falls back to localStorage; native platforms
 * use the Keychain/Keystore-backed SecureStore.
 *
 * Note: SecureStore has historically rejected values above ~2048 bytes
 * on iOS. A Supabase session (access + refresh token) can exceed that.
 * If that's hit in practice, this adapter should move to an encrypted
 * large-value scheme (AES key in SecureStore, ciphertext in AsyncStorage).
 */
export const authStorage = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      return Promise.resolve(globalThis.localStorage?.getItem(key) ?? null);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};
