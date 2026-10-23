import { Image } from "expo-image";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";

import { alpha, colors, fontFamilyByWeight, radii, typeScale, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

/** One editable vocabulary word in the teacher's draft. */
export interface DraftWord {
  key: string;
  word: string;
  transcription: string;
  translation: string;
  /** Public image URL, already in Storage. */
  imageUrl: string | null;
  /** Hint the image model illustrates for this word. */
  imagePrompt: string | null;
}

export interface VocabWordEditorProps {
  word: DraftWord;
  index: number;
  imageBusy: boolean;
  onChange: (patch: Partial<DraftWord>) => void;
  onRemove: () => void;
  onGenerateImage: () => void;
  onUploadImage: () => void;
}

/** No help from the keyboard: a word, its IPA or its translation is never prose to "fix". */
const FIELD = { autoCapitalize: "none", autoCorrect: false, spellCheck: false, autoComplete: "off" } as const;

/**
 * Port of upstream's `teacher/VocabWordEditor.tsx`: one word row — the word,
 * its transcription and translation, and its flashcard picture (AI or
 * upload). Presentational; the editor owns the list.
 */
export function VocabWordEditor({ word, index, imageBusy, onChange, onRemove, onGenerateImage, onUploadImage }: VocabWordEditorProps) {
  const picture = imageSource(word.imageUrl);
  const label = word.word.trim() || `word ${index + 1}`;

  return (
    <View style={styles.row}>
      <View style={styles.imageCol}>
        <View style={styles.image}>
          {imageBusy ? (
            <ActivityIndicator color={colors.purple} accessibilityLabel={`Making a picture for ${label}`} />
          ) : picture ? (
            <Image source={picture} style={styles.fill} contentFit="cover" accessibilityLabel={word.word} />
          ) : (
            <SlayText variant="h3" accessible={false}>
              🖼️
            </SlayText>
          )}
        </View>
        <View style={styles.imageButtons}>
          <SlayPressable
            accessibilityRole="button"
            accessibilityLabel={`AI picture for ${label}`}
            disabled={imageBusy || !word.word.trim()}
            onPress={onGenerateImage}
            style={[styles.tiny, styles.tinyAi, (imageBusy || !word.word.trim()) && styles.dim]}
          >
            <SlayText variant="label" weight="700" style={styles.tinyText}>
              AI
            </SlayText>
          </SlayPressable>
          <SlayPressable
            accessibilityRole="button"
            accessibilityLabel={`Upload a picture for ${label}`}
            disabled={imageBusy}
            onPress={onUploadImage}
            style={[styles.tiny, styles.tinyUpload, imageBusy && styles.dim]}
          >
            <SlayText variant="label" weight="700" style={styles.tinyText}>
              Upload
            </SlayText>
          </SlayPressable>
        </View>
      </View>

      <View style={styles.fields}>
        <View style={styles.wordLine}>
          <SlayText variant="label" weight="700" color={alpha.white50}>
            #{index + 1}
          </SlayText>
          <TextInput
            maxFontSizeMultiplier={1.5}
            value={word.word}
            onChangeText={(text) => onChange({ word: text })}
            placeholder="word (English)"
            placeholderTextColor={alpha.white50}
            selectionColor={colors.neonPink}
            accessibilityLabel={`Word ${index + 1}`}
            style={[styles.input, styles.wordInput]}
            {...FIELD}
          />
          <SlayPressable accessibilityRole="button" accessibilityLabel={`Remove ${label}`} hitSlop={8} onPress={onRemove} style={styles.remove}>
            <SlayText variant="small" color={colors.neonPink}>
              ✕
            </SlayText>
          </SlayPressable>
        </View>
        <TextInput
          maxFontSizeMultiplier={1.5}
          value={word.transcription}
          onChangeText={(text) => onChange({ transcription: text })}
          placeholder="/trænˈskrɪp.ʃən/"
          placeholderTextColor={alpha.white50}
          selectionColor={colors.neonPink}
          accessibilityLabel={`Transcription ${index + 1}`}
          style={styles.input}
          {...FIELD}
        />
        <TextInput
          maxFontSizeMultiplier={1.5}
          value={word.translation}
          onChangeText={(text) => onChange({ translation: text })}
          placeholder="translation"
          placeholderTextColor={alpha.white50}
          selectionColor={colors.neonPink}
          accessibilityLabel={`Translation ${index + 1}`}
          style={styles.input}
          {...FIELD}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: alpha.white10, backgroundColor: colors.surface, padding: 12 },
  imageCol: { alignItems: "center", gap: 6 },
  image: { width: 80, height: 80, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: radii.md, backgroundColor: alpha.white5 },
  fill: { width: "100%", height: "100%" },
  imageButtons: { flexDirection: "row", gap: 4 },
  tiny: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tinyAi: { backgroundColor: withAlpha(colors.purple, 0.8) },
  tinyUpload: { backgroundColor: alpha.white10 },
  tinyText: { fontSize: 10 },
  dim: { opacity: 0.4 },
  fields: { flex: 1, minWidth: 0, gap: 6 },
  wordLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  // An input's intrinsic width must not push the card wider than the screen.
  grow: { flex: 1, minWidth: 0 },
  wordInput: { flex: 1, width: undefined },
  remove: { paddingHorizontal: 6, paddingVertical: 4 },
  input: {
    minWidth: 0,
    width: "100%",
    minHeight: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha.white20,
    backgroundColor: alpha.white10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.white,
    fontFamily: fontFamilyByWeight["400"],
    fontSize: typeScale.small.max,
  },
});
