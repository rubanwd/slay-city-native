import { useState } from "react";
import { Image } from "expo-image";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";

import type { ContentImageFolder } from "@slay/data";
import { alpha, colors, radii } from "@slay/tokens";

import { SlayButton, SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

import { pickAndUploadImage } from "./pickAndUpload";

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
    busy(true);
    const result = await pickAndUploadImage(folder);
    busy(false);
    if (result.kind === "uploaded") onChange(result.url);
    else if (result.kind === "denied") {
      setBlocked(!result.canAskAgain);
      setError(result.error);
    } else if (result.kind === "failed") setError(result.error);
  };

  return (
    <View style={styles.field}>
      <SlayText variant="label" color={alpha.white50}>
        {label}
      </SlayText>
      {preview ? <Image source={preview} style={styles.preview} contentFit="cover" accessibilityLabel={label} /> : null}
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
