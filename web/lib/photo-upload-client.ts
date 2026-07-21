"use client";

import { createClient } from "@/lib/supabase/client";

// Client-side counterpart to lib/photo-upload.ts's uploadPhotoFile — uploads
// straight from the browser to Supabase Storage instead of routing the file
// through a Server Action. That matters because a Server Action's request
// body goes through Vercel's serverless function invocation, which has its
// own hard platform-level payload ceiling (historically ~4.5MB on the Node
// runtime) sitting UNDER Next.js — next.config.ts's bodySizeLimit only
// governs Next's own parsing and can't raise that floor. A real tank scene
// photo (8-20MB) needs to skip that hop entirely.
//
// HEIC/HEIF (the default iPhone camera format) is converted to JPEG here,
// in-browser, before upload — browsers can't render HEIF inline, and nothing
// in this app does a server-side transform pass on stored photos.

export const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const HEIF_MIME = new Set(["image/heic", "image/heif"]);
export const MAX_BYTES = 20 * 1024 * 1024;

export async function uploadImageDirect(
  file: File,
): Promise<{ path: string; publicUrl: string } | { error: string }> {
  if (!file || file.size === 0) return { error: "Choose an image to upload." };
  if (file.size > MAX_BYTES) return { error: "Image must be under 20MB." };

  const isHeif = HEIF_MIME.has(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!isHeif && !ALLOWED_MIME.has(file.type)) {
    return { error: "Only JPG, PNG, WEBP, or HEIC/HEIF images are supported." };
  }

  let uploadBlob: Blob = file;
  let contentType = file.type;
  let ext = file.name.split(".").pop()?.toLowerCase() || "jpg";

  if (isHeif) {
    try {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      uploadBlob = Array.isArray(converted) ? converted[0] : converted;
      contentType = "image/jpeg";
      ext = "jpg";
    } catch {
      return { error: "Couldn't convert this HEIC/HEIF photo — try exporting it as JPEG first." };
    }
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("coral-photos")
    .upload(path, uploadBlob, { contentType });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const {
    data: { publicUrl },
  } = supabase.storage.from("coral-photos").getPublicUrl(path);

  return { path, publicUrl };
}
