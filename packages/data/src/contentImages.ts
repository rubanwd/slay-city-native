import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@slay/core/types";

/** Storage bucket for content imagery (see upstream's content_images migration). */
const BUCKET = "content";

export type ContentImageFolder = "districts" | "locations" | "wardrobe" | "homework" | "tasks" | "feedback";

export interface ContentImageUpload {
  /** The image's bytes. */
  body: ArrayBuffer;
  contentType: string;
  ext: string;
  /**
   * The object's unique name. Passed in rather than generated here, so this
   * package needs no platform crypto — the app has `expo-crypto`.
   */
  id: string;
}

/**
 * Port of upstream's `admin/uploadContentImage.ts`: uploads an image to the
 * public `content` bucket and returns its public URL. Storage RLS restricts
 * writes to admins for every folder except `homework/` (teachers) and
 * `feedback/` (any signed-in user, for bug screenshots). Each upload gets a
 * unique name, so old images are orphaned rather than overwritten.
 *
 * Throws on failure, as upstream does — the caller shows the message.
 */
export async function uploadContentImage(
  db: SupabaseClient<Database>,
  folder: ContentImageFolder,
  { body, contentType, ext, id }: ContentImageUpload
): Promise<string> {
  const path = `${folder}/${id}.${ext}`;

  const { error } = await db.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw error;

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
