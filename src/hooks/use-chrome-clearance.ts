import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getFloatingHeaderClearance } from '@/components/header';
import { getFloatingFriendsSubNavClearance } from '@/components/friends-sub-nav';
import { getFloatingNavClearance } from '@/components/navigation';
import { getFloatingSubNavClearance } from '@/components/training-sub-nav';

/** Single source of truth for how much top/bottom space routed content
 * needs to clear the floating Header and bottom Navigation — every real
 * scroll-owning component pulls from this rather than each guessing its
 * own numbers. Deliberately not applied via an ancestor's padding: RN
 * shrinks a scrolling descendant's own frame to fit an ancestor's padding,
 * so the clearance has to live on each scrolling widget's own
 * `contentContainerStyle` instead. */
export function useChromeClearance() {
  const insets = useSafeAreaInsets();
  return {
    top: getFloatingHeaderClearance(insets.top),
    bottom: getFloatingNavClearance(insets.bottom),
  };
}

/** Same as `useChromeClearance`, for screens under the Training route group
 * only — `bottom` additionally clears the floating `TrainingSubNav` stacked
 * above the main Navigation bar. */
export function useTrainingChromeClearance() {
  const insets = useSafeAreaInsets();
  return {
    top: getFloatingHeaderClearance(insets.top),
    bottom: getFloatingSubNavClearance(insets.bottom),
  };
}

/** Same as `useChromeClearance`, for Friends/Requests/Users only — `bottom`
 * additionally clears the floating `FriendsSubNav` stacked above the main
 * Navigation bar. */
export function useFriendsChromeClearance() {
  const insets = useSafeAreaInsets();
  return {
    top: getFloatingHeaderClearance(insets.top),
    bottom: getFloatingFriendsSubNavClearance(insets.bottom),
  };
}
