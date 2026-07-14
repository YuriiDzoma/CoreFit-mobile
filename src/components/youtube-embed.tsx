import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { getYouTubeEmbedUrl } from '@/lib/youtube-url';

type YoutubeEmbedProps = {
  url: string | null;
  title: string;
};

// YouTube's embedded player validates the request's origin/referrer before
// initializing playback. Navigating a WebView straight to the embed URL via
// `source={{ uri }}` has no originating page, so YouTube rejects it with
// "Error 153, Video Player Configuration Error". Loading a local HTML
// document containing a real <iframe> — with a stable baseUrl, giving it a
// legitimate page context — is the confirmed fix:
// https://github.com/react-native-webview/react-native-webview/issues/3889
const EMBED_BASE_URL = 'https://myapp.local';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmbedHtml(embedUrl: string, title: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: transparent; }
      iframe { width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <iframe src="${embedUrl}" title="${escapeHtml(title)}" allowfullscreen></iframe>
  </body>
</html>`;
}

export function YoutubeEmbed({ url, title }: YoutubeEmbedProps) {
  const embedUrl = getYouTubeEmbedUrl(url);
  if (!embedUrl) return null;

  return (
    <WebView
      source={{ html: buildEmbedHtml(embedUrl, title), baseUrl: EMBED_BASE_URL }}
      style={styles.webview}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      accessibilityLabel={title}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
});
