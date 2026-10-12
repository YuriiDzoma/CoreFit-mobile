import { SymbolView } from 'expo-symbols';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { TrainerBadge } from '@/components/trainer-badge';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatLastActive } from '@/lib/lastActive';
import type { Profile } from '@/lib/supabase/profile';

interface ProfileHeaderProps {
  profile: Profile;
  /** Overrides `profile.username` for the name line — `profile/index.tsx`
   * falls back to the signed-in user's email when `username` is unset;
   * `profile/[id].tsx` falls back to a generic "Unknown user" string
   * instead. Each screen's own fallback stays its own, rather than this
   * component guessing one. */
  displayName?: string | null;
  isOwnProfile: boolean;
  /** `TrainerBadge`'s own client count — 0 when unknown/not yet loaded.
   * Only rendered at all when `profile.is_trainer`. */
  trainerClientCount: number;
  avatarUploading?: boolean;
  onAvatarPress: () => void;
  /** Rendered as the absolutely-positioned gear icon, own-profile only —
   * omit entirely (not just `isOwnProfile: false`) on a screen that has
   * nowhere for it to navigate to. */
  onSettingsPress?: () => void;
  /** The bold underlined "Programs" link below the info lines — web's own
   * `.programsLink`. Omit on a screen whose programs live inline instead
   * of behind a link (there isn't one left in this app, but kept optional
   * rather than required so a future screen isn't forced to have it). */
  onProgramsPress?: () => void;
  /** Slot for whatever renders below the info lines and Programs link —
   * `profile/index.tsx` has nothing here; `profile/[id].tsx` puts its
   * Sign Out button or friend/trainer-request actions here, matching
   * web's own separate `.profile__actions` block immediately following
   * this same header. */
  children?: ReactNode;
}

/**
 * Shared avatar/name/info header for both profile screens — mirrors web's
 * own `Profile.client.tsx`, which is literally the same component for
 * both the signed-in user's own profile and someone else's (only the
 * avatar-upload affordance, settings icon, and action buttons below differ
 * by `isOwnProfile`). Extracted here once both mobile screens converged on
 * the same visual shape, to make that structural fact explicit in code —
 * the exact divergence this app's own docs/decisions.md history shows
 * recurring whenever the two screens' headers were edited independently.
 *
 * A left-aligned row (`.profile__header`: avatar left, text stack right) —
 * not the centered column `profile/[id].tsx` used before this, which never
 * matched web at all. Avatar is a 4px-radius square (`profiles.module.scss`'s
 * `img{border-radius:4px}`), not circular like Home's feed avatars.
 */
export function ProfileHeader({
  profile,
  displayName,
  isOwnProfile,
  trainerClientCount,
  avatarUploading = false,
  onAvatarPress,
  onSettingsPress,
  onProgramsPress,
  children,
}: ProfileHeaderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const name = displayName ?? profile.username;

  // Web's `.profile__header span { opacity: 0.4 }` dims every secondary
  // info line by default; `.profile__online` is the one override (full
  // opacity, success color) — matched here as a shared style rather than
  // reached for ad hoc at each call site, so "Registered"/city/offline
  // last-active all stay visually identical the way web's single cascade
  // rule guarantees for free.
  const dimStyle = [styles.dim, { color: theme.text }];
  const lastActive = !isOwnProfile ? formatLastActive(profile.last_active_at) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onAvatarPress} disabled={avatarUploading}>
          <Avatar uri={profile.avatar_url} name={name} size={96} radius={Spacing.one} />
          {avatarUploading && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </Pressable>

        <View style={styles.headerText}>
          {name && <ThemedText style={styles.username}>{name}</ThemedText>}

          {/* Profile.client.tsx: `{base.registered} {date}` — uk-UA-formatted
              regardless of the active UI language (matching web's own
              hardcoded locale here — see e.g. trainingHistory's identical
              choice). The raw email is intentionally never shown here —
              web's own profile header never renders it either. */}
          {profile.created_at && (
            <ThemedText style={dimStyle}>
              {t('profile.registered')}{' '}
              {new Date(profile.created_at).toLocaleDateString('uk-UA', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </ThemedText>
          )}

          {lastActive && (
            <ThemedText
              style={
                lastActive.isOnline ? [styles.dim, { opacity: 1, color: theme.success }] : dimStyle
              }
            >
              {lastActive.text}
            </ThemedText>
          )}

          {profile.city && (
            <ThemedText style={dimStyle}>
              {profile.city}
              {profile.country ? `, ${profile.country}` : ''}
            </ThemedText>
          )}

          {profile.is_trainer && <TrainerBadge clientCount={trainerClientCount} />}

          {onProgramsPress && (
            <Pressable onPress={onProgramsPress}>
              <ThemedText style={[styles.programsLink, { color: theme.text }]}>
                {t('components.trainingSubNav.programs')}
              </ThemedText>
            </Pressable>
          )}

          {children}
        </View>
      </View>

      {onSettingsPress && (
        <Pressable style={styles.settingsIcon} onPress={onSettingsPress}>
          <SymbolView
            name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
            size={24}
            tintColor={theme.text}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.two,
    justifyContent: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: Spacing.one,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `p{font-size:18px; margin:8px 0}`. `lineHeight` is set explicitly
  // rather than left to inherit `ThemedText`'s default-type value (24,
  // meant for 16px body text) -- unlike a browser's own tight, unset
  // line-height (~1.15-1.2x font-size) web's `p`/`span` render at here, RN
  // never shrinks a text node's box below its declared `lineHeight`
  // regardless of font size.
  username: {
    fontSize: 18,
    lineHeight: 22,
    marginVertical: Spacing.two,
  },
  // `span{opacity:0.4}` — dimmed via opacity, not a themeColor swap.
  dim: {
    fontSize: 16,
    lineHeight: 20,
    opacity: 0.4,
  },
  // `.programsLink span{font-size:16px; opacity:1; font-weight:600;
  // letter-spacing:1.1; text-decoration:underline}`.
  programsLink: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 1.1,
    textDecorationLine: 'underline',
    marginTop: Spacing.one,
  },
  // `.settings{position:absolute; right:4px; top:4px}`.
  settingsIcon: {
    position: 'absolute',
    right: 4,
    top: 4,
  },
});
