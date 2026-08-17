import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { type Profile } from '@/lib/supabase/profile';

const PREVIEW_COUNT = 3;
const PREVIEW_AVATAR_SIZE = 64;

interface PeoplePreviewProps {
  people: Profile[];
  /** Pre-translated, e.g. "Clients: 2" or "Trainer: 1" — the two contexts
   * this is used for need different plural forms (clients vs trainer),
   * so the caller resolves the right i18n key rather than this component
   * owning that choice. */
  title: string;
  onPersonPress: (id: string) => void;
}

/**
 * Same avatar-above-name grid as `FriendsPreview`, for the Profile
 * screen's trainer/client block. Not built on `FriendsPreview` itself:
 * that component's whole block is one `Pressable` to a dedicated "see
 * all" list screen, which trainer/client relationships don't have —
 * usually one trainer, or a handful of clients, not enough to need a
 * screen of their own. Callers must not render this at all when `people`
 * is empty (no dedicated screen to link an empty state to either).
 */
export function PeoplePreview({ people, title, onPersonPress }: PeoplePreviewProps) {
  const { t } = useTranslation();

  return (
    <ThemedView>
      <ThemedText type="smallBold" style={styles.header}>
        {title}
      </ThemedText>

      <ThemedView style={styles.grid}>
        {people.slice(0, PREVIEW_COUNT).map((person) => (
          <Pressable key={person.id} style={styles.item} onPress={() => onPersonPress(person.id)}>
            <Avatar uri={person.avatar_url} name={person.username} size={PREVIEW_AVATAR_SIZE} />
            <ThemedText type="small" style={styles.itemName} numberOfLines={2}>
              {person.username ?? t('components.friendsPreview.unknownName')}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  item: {
    alignItems: 'center',
    width: PREVIEW_AVATAR_SIZE,
    gap: Spacing.one,
  },
  itemName: {
    textAlign: 'center',
  },
});
