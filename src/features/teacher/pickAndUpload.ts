import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";

import { uploadContentImage, type ContentImageFolder } from "@slay/data";

import { prepareScreenshot } from "~/features/feedback";
import { supabase } from "~/lib/supabase";

export type PickAndUploadResult =
  | { kind: "uploaded"; url: string }
  | { kind: "canceled" }
  | { kind: "denied"; error: string; canAskAgain: boolean }
  | { kind: "failed"; error: string };

/**
 * Picks one picture from the phone, shrinks it (`prepareScreenshot`) and
 * uploads it to the public `content` bucket — the native counterpart of an
 * `<input type="file">` feeding upstream's `uploadContentImage`.
 */
export async function pickAndUploadImage(folder: ContentImageFolder): Promise<PickAndUploadResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { kind: "denied", error: "SLAY CITY needs access to your photos to add a picture.", canAskAgain: permission.canAskAgain };
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (result.canceled || result.assets.length === 0) return { kind: "canceled" };

  try {
    const image = await prepareScreenshot(result.assets[0]);
    return { kind: "uploaded", url: await uploadContentImage(supabase, folder, { ...image, id: Crypto.randomUUID() }) };
  } catch (err) {
    return { kind: "failed", error: err instanceof Error ? err.message : "Upload failed." };
  }
}
