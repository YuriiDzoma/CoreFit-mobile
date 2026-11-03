// A profile always has *some* avatar_url (a real photo, or the
// ui-avatars.com fallback generated at signup -- see auth.ts) -- this
// distinguishes the two, for anything that should only apply to a genuine
// photo (the fullscreen viewer, the "Видалити фото" action-sheet option).
export function hasRealAvatar(url?: string | null): boolean {
  return Boolean(url) && !url!.includes('ui-avatars.com');
}

// Same initials image web's `lib/avatarFallback.ts` builds -- what web shows
// for a profile with no avatar_url or one that fails to load.
export function avatarFallbackUrl(name?: string | null): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '?')}&format=png`;
}
