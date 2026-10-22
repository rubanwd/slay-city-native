import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Image, Linking, StyleSheet, View } from "react-native";

import { uploadContentImage, type ContentImageFolder } from "@slay/data";
import { alpha, colors, radii } from "@slay/tokens";

import { SlayButton, SlayText } from "~/components/ui";
import { prepareScreenshot } from "~/features/feedback";
import { imageSource } from "~/lib/imageSource";
import { supabase } from "~/lib/supabase";

export interface ImageUploadFieldProps {
  label: string;
  folder: ContentImageFolder;
  /** The public URL, or "" for none. */
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
}

/**
 * Port of upstream's `admin/ImageUploadField.tsx` as the teacher uses it: pick
 * one picture from the phone, shrink it, upload it to the public `content`
 * bucket, and hold its URL for the form. Remove clears it. A refused photo
 * permission explains itself and offers Settings, as the Feedback picker does.
 */
export function ImageUploadField({ label, folder, value, onChange, disabled = false, onUploadingChange }: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const preview = imageSource(value || null);

  const busy = (next: boolean) => {
    setUploading(next);
    onUploadingChange?.(next);
  };

  const pick = async () => {
    setError(null);
    setBlocked(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setBlocked(!permission.canAskAgain);
      setError("SLAY CITY needs access to your photos to add a picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (result.canceled || result.assets.length === 0) return;

    busy(true);
    try {
      const image = await prepareScreenshot(result.assets[0]);
      onChange(await uploadContentImage(supabase, folder, { ...image, id: Crypto.randomUUID() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      busy(false);
    }
  };

  return (
    <View style={styles.field}>
      <SlayText variant="label" color={alpha.white50}>
        {label}
      </SlayText>
      {preview ? <Image source={preview} style={styles.preview} resizeMode="cover" accessibilityLabel={label} /> : null}
      <View style={styles.actions}>
        <SlayButton variant="ghost" size="sm" loading={uploading} disabled={disabled} onPress={() => void pick()}>
          {value ? "Replace picture" : "Add picture"}
        </SlayButton>
        {value ? (
          <SlayButton variant="ghost" size="sm" disabled={disabled || uploading} onPress={() => onChange("")}>
            Remove
          </SlayButton>
        ) : null}
        {uploading ? <ActivityIndicator color={colors.cyan} accessibilityLabel="Uploading…" /> : null}
      </View>
      {error ? (
        <SlayText variant="small" weight="600" color={colors.neonPink} accessibilityRole="alert">
          {error}
        </SlayText>
      ) : null}
      {blocked ? (
        <SlayButton variant="ghost" size="sm" onPress={() => void Linking.openSettings()}>
          Open Settings
        </SlayButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  preview: { width: "100%", aspectRatio: 16 / 9, borderRadius: radii.md },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
