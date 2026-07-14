const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const YOUTU_BE_HOSTS = new Set(['youtu.be', 'www.youtu.be']);

/**
 * Normalizes any of YouTube's URL shapes (watch, shorts, youtu.be short
 * links, already-embedded) into a canonical embeddable URL. Uses the URL
 * API rather than a single regex so each shape is parsed structurally
 * (host, path segments, query params) instead of pattern-matched as text.
 * Returns null for anything that isn't a parseable, supported YouTube URL.
 */
export function getYouTubeEmbedUrl(url: string | null): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  let videoId: string | null = null;

  if (YOUTUBE_HOSTS.has(host)) {
    if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v');
    } else if (parsed.pathname.startsWith('/shorts/')) {
      videoId = parsed.pathname.split('/')[2] ?? null;
    } else if (parsed.pathname.startsWith('/embed/')) {
      videoId = parsed.pathname.split('/')[2] ?? null;
    }
  } else if (YOUTU_BE_HOSTS.has(host)) {
    videoId = parsed.pathname.split('/')[1] ?? null;
  }

  if (!videoId) return null;

  return `https://www.youtube.com/embed/${videoId}`;
}
