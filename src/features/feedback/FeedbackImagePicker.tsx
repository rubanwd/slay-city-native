import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image } from "expo-image";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { FEEDBACK_IMAGE_FOLDER, MAX_IMAGES } from "@slay/core";
import { uploadContentImage } from "@slay/data";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

import { prepareScreenshot } from "./prepareScreenshot";

export interface FeedbackImagePickerProps {
  /** Public URLs of the screenshots attached so far, in the order they were added. */
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
  /** Tells the sheet an upload is running, so Send waits for it. */
  onUploadingChange?: (uploading: boolean) => void;
}

/**
 * Port of upstream's `feedback/FeedbackImagePicker.tsx`: attaches up to
 * {@link MAX_IMAGES} screenshots to a report. Each one is shrunk
 * ({@link prepareScreenshot}) and uploaded to the public `content` bucket's
 * `feedback/` folder as soon as it is picked, so the report itself carries
 * plain URLs and a slow upload never blocks typing.
 *
 * The phone's photo library needs the student's say-so. If they refuse, the
 * picker says why it can't open and — once the system will no longer ask
 * again — offers the Settings app; the report can always go without pictures.
 */
export function FeedbackImagePicker({ value, onChange, disabled = false, onUploadingChange }: FeedbackImagePickerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const remaining = MAX_IMAGES - value.length;

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
      setError("SLAY CITY needs access to your photos to attach screenshots. You can still send the report without them.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    });
    if (result.canceled || result.assets.length === 0) return;

    const picked = result.assets.slice(0, remaining);
    busy(true);
    try {
      const urls = await Promise.all(
        picked.map(async (asset) =>
          uploadContentImage(supabase, FEEDBACK_IMAGE_FOLDER, { ...(await prepareScreenshot(asset)), id: Crypto.randomUUID() }),
        ),
      );
      onChange([...value, ...urls]);
      if (result.assets.length > picked.length) {
        setError(`Only ${MAX_IMAGES} images per report — the extra ones were skipped.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      busy(false);
    }
  };

  return (
    <View style={styles.box}>
      <SlayText variant="label" color={alpha.white50}>
        Screenshots (optional, up to {MAX_IMAGES})
      </SlayText>

      <View style={styles.row}>
        {value.map((url, index) => (
          <View key={url} style={styles.thumb}>
            <Image source={{ uri: url }} style={styles.thumbImage} contentFit="cover" accessibilityLabel={`Screenshot ${index + 1}`} />
            <SlayPressable
              accessibilityRole="button"
              accessibilityLabel={`Remove screenshot ${index + 1}`}
              disabled={disabled}
              hitSlop={8}
              onPress={() => onChange(value.filter((item) => item !== url))}
              style={styles.remove}
            >
              <Svg width={10} height={10} viewBox="0 0 16 16" fill="none">
                <Path d="M2 2l12 12M14 2L2 14" stroke={alpha.white80} strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
            </SlayPressable>
          </View>
        ))}

        {remaining > 0 ? (
          <SlayPressable
            accessibilityRole="button"
            accessibilityLabel={uploading ? "Uploading screenshots…" : "Add screenshot"}
            disabled={disabled || uploading}
            onPress={() => void pick()}
            style={({ pressed }) => [styles.thumb, styles.add, pressed && styles.addPressed, (disabled || uploading) && styles.dim]}
          >
            {uploading ? (
              <ActivityIndicator color={colors.cyan} />
            ) : (
              <>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Rect x={3} y={5} width={18} height={14} rx={2} stroke={alpha.white50} strokeWidth={2} />
                  <Circle cx={9} cy={11} r={2} stroke={alpha.white50} strokeWidth={2} />
                  <Path d="M21 16l-5-5-6 6" stroke={alpha.white50} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <SlayText variant="label" weight="700" color={alpha.white50}>
                  Add
                </SlayText>
              </>
            )}
          </SlayPressable>
        ) : null}
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

const THUMB = 80;

const styles = StyleSheet.create({
  box: { gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: {
    width: THUMB,
    height: THUMB,
    overflow: "hidden",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha.white15,
    backgroundColor: alpha.white5,
  },
  thumbImage: { width: "100%", height: "100%" },
  remove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: withAlpha(colors.black, 0.7),
  },
  add: { alignItems: "center", justifyContent: "center", gap: 4, borderStyle: "dashed", borderColor: alpha.white25, backgroundColor: "transparent" },
  addPressed: { borderColor: colors.cyan },
  dim: { opacity: 0.5 },
});
