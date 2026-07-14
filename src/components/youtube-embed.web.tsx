import { getYouTubeEmbedUrl } from '@/lib/youtube-url';

type YoutubeEmbedProps = {
  url: string | null;
  title: string;
};

export function YoutubeEmbed({ url, title }: YoutubeEmbedProps) {
  const embedUrl = getYouTubeEmbedUrl(url);
  if (!embedUrl) return null;

  return (
    <iframe
      src={embedUrl}
      title={title}
      allowFullScreen
      style={{ width: '100%', aspectRatio: '16 / 9', border: 0 }}
    />
  );
}
