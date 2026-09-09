import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase/client';

const AVATARS_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export class AvatarTooLargeError extends Error {}

// null return means either the user cancelled or denied the permission
// prompt -- both are silent no-ops from the caller's point of view.
export async function pickAvatarImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: 0.9,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0];
}

// A fresh timestamped filename per upload (not a fixed name overwritten in
// place) sidesteps caching an old photo under the same URL -- the
// tradeoff is old files need their own cleanup, see deleteAvatarFile.
export async function uploadAvatar(userId: string, asset: ImagePicker.ImagePickerAsset): Promise<string> {
  if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
    throw new AvatarTooLargeError('Avatar file is too large');
  }

  // RN has no File/Blob upload path the way the web SDK does -- fetching
  // the local asset URI and uploading the raw bytes is Supabase's own
  // documented approach for Expo.
  const arrayBuffer = await fetch(asset.uri).then((response) => response.arrayBuffer());
  if (arrayBuffer.byteLength > MAX_AVATAR_BYTES) {
    throw new AvatarTooLargeError('Avatar file is too large');
  }

  // Prefer mimeType over parsing the URI -- on web, expo-image-picker's
  // uri is a blob: URL with no real file extension to extract at all
  // (confirmed live: naively splitting on "." there grabbed the entire
  // blob URL as the "extension").
  const extension = asset.mimeType?.split('/').pop() || asset.uri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `${userId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, arrayBuffer, {
    contentType: asset.mimeType ?? 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Best-effort, and a deliberate no-op for anything that isn't one of our
// own uploaded files (a Google photo URL or a ui-avatars.com fallback --
// we don't own either of those, and must never try to delete them).
export async function deleteAvatarFile(url: string | null | undefined): Promise<void> {
  if (!url) return;

  const marker = `/storage/v1/object/public/${AVATARS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return;

  const path = decodeURIComponent(url.slice(index + marker.length));
  await supabase.storage.from(AVATARS_BUCKET).remove([path]).catch(() => {});
}
