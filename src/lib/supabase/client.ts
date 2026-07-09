import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { authStorage } from '@/lib/supabase/storage';

export const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
