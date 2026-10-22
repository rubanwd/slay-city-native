import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Switch, TextInput, View } from "react-native";

import { buildVocabTest, clampWordCount, defaultTestTaskCount, describeVocabTask, MAX_VOCAB_WORDS, type TopicSource } from "@slay/core";
import { clearVocabulary, copyVocabularyFromTopic, generateVocabularyDraft, generateWordImage, publishVocabulary, type TeacherVocabWord } from "@slay/data";
import { alpha, colors, fontFamilyByWeight, radii, typeScale, withAlpha } from "@slay/tokens";

import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

import { pickAndUploadImage } from "./pickAndUpload";
import { TEACHER_DASHBOARD_QUERY_KEY, TEACHER_GROUP_QUERY_KEY, TEACHER_TOPIC_QUERY_KEY } from "./queryKeys";
import { TestPreviewRunner } from "./TestPreviewRunner";
import { TopicContentImporter } from "./TopicContentImporter";
import { VocabWordEditor, type DraftWord } from "./VocabWordEditor";

export interface VocabularyManagerProps {
  topicId: string;
  groupId: string;
  initialWords: TeacherVocabWord[];
  /** How many test tasks the published set has (0 if none). */
  initialTaskCount: number;
  /** This teacher's other topics with vocabulary, to copy from. */
  reuseSources: TopicSource[];
}

/** How many word pictures are made at once in the background — each call takes seconds. */
const IMAGE_CONCURRENCY = 3;

interface ImageJob {
  total: number;
  done: number;
  failed: number;
}

type Status = { kind: "error" | "success"; text: string } | null;

let keySeq = 0;
const nextKey = () => `w${keySeq++}`;

const toDraft = (w: { word: string; transcription: string | null; translation: string | null; imageUrl: string | null }, imagePrompt: string | null = null): DraftWord => ({
  key: nextKey(),
  word: w.word,
  transcription: w.transcription ?? "",
  translation: w.translation ?? "",
  imageUrl: w.imageUrl,
  imagePrompt,
});

const blankDraft = (): DraftWord => toDraft({ word: "", transcription: null, translation: "", imageUrl: null });

/** Everything Publish sends — compared with the last publish to tell whether anything changed. */
function publishSignature(words: Pick<DraftWord, "word" | "transcription" | "translation" | "imageUrl">[], taskCount: number, seed: number): string {
  return `${words.map((w) => [w.word, w.transcription, w.translation, w.imageUrl ?? ""].join("\u0001")).join("\u0002")}|${taskCount}|${seed}`;
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.numberField}>
      <SlayText variant="label" color={alpha.white50} style={styles.plain}>
        {label}
      </SlayText>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        maxLength={2}
        accessibilityLabel={label}
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        selectionColor={colors.neonPink}
        style={styles.input}
      />
    </View>
  );
}

/**
 * Port of upstream's `teacher/VocabularyManager.tsx`: a topic's vocabulary —
 * one editable word list, filled by hand, drafted with AI, or copied from
 * another of the teacher's topics. Pictures are optional: AI per word or for
 * the whole draft, or an upload. The test is core's seeded `buildVocabTest`,
 * previewed live and playable before Publish replaces the topic's set.
 *
 * Nothing touches the database until Publish. The AI calls go to the WP-5.6
 * Edge Functions; until those are deployed they fail with a readable message
 * and the teacher authors by hand. At most {@link MAX_VOCAB_WORDS} words, so the
 * list needs no virtualisation.
 */
export function VocabularyManager({ topicId, groupId, initialWords, initialTaskCount, reuseSources }: VocabularyManagerProps) {
  const queryClient = useQueryClient();
  const [words, setWords] = useState<DraftWord[]>(() => initialWords.map((w) => toDraft(w)));
  // Counts stay raw text so a field can be emptied while typing.
  const initialTasks = initialTaskCount > 0 ? initialTaskCount : defaultTestTaskCount(initialWords.length);
  const [taskCount, setTaskCount] = useState(String(initialTasks));
  const [wordCount, setWordCount] = useState(String(initialWords.length || 6));
  const [testSeed, setTestSeed] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [extra, setExtra] = useState("");
  const [autoImages, setAutoImages] = useState(true);
  const [busyImages, setBusyImages] = useState<Set<string>>(new Set());
  const [imageJob, setImageJob] = useState<ImageJob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasPublished, setHasPublished] = useState(initialWords.length > 0);
  const [status, setStatus] = useState<Status>(null);
  const [publishedSig, setPublishedSig] = useState(() => publishSignature(words, initialTasks, 0));
  // A background image job outliving the screen must not set state on it.
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  const taskCountValue = Math.max(0, Math.round(Number(taskCount) || 0));
  const dirty = publishSignature(words, taskCountValue, testSeed) !== publishedSig;
  const busy = generating || importing || publishing;

  // The very test Publish will build, from the same builder.
  const previewTasks = useMemo(
    () =>
      buildVocabTest(
        words.filter((w) => w.word.trim() && w.translation.trim()).map((w) => ({ word: w.word, translation: w.translation, imageUrl: w.imageUrl })),
        taskCountValue,
        testSeed,
      ),
    [words, taskCountValue, testSeed],
  );

  const patchWord = (key: string, patch: Partial<DraftWord>) => setWords((prev) => prev.map((w) => (w.key === key ? { ...w, ...patch } : w)));
  const setImageBusy = (key: string, isBusy: boolean) =>
    setBusyImages((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(key);
      else next.delete(key);
      return next;
    });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [TEACHER_TOPIC_QUERY_KEY, topicId] }),
      queryClient.invalidateQueries({ queryKey: [TEACHER_GROUP_QUERY_KEY, groupId] }),
      queryClient.invalidateQueries({ queryKey: [TEACHER_DASHBOARD_QUERY_KEY] }),
    ]);

  /** Makes pictures for a batch of words in the background, a few at a time, while the teacher keeps editing. */
  const runBackgroundImages = async (targets: { key: string; word: string; imagePrompt: string | null }[]) => {
    const pending = targets.filter((t) => t.word.trim());
    if (pending.length === 0) return;
    setImageJob((prev) => ({ total: (prev?.total ?? 0) + pending.length, done: prev?.done ?? 0, failed: prev?.failed ?? 0 }));

    let cursor = 0;
    let failed = 0;
    const worker = async () => {
      while (cursor < pending.length) {
        const item = pending[cursor++];
        setImageBusy(item.key, true);
        const result = await generateWordImage(supabase, { topicId, word: item.word, imagePrompt: item.imagePrompt });
        if (!live.current) return;
        setImageBusy(item.key, false);
        if (result.ok) patchWord(item.key, { imageUrl: result.imageUrl });
        else failed++;
        setImageJob((prev) => (prev ? { total: prev.total, done: prev.done + 1, failed: prev.failed + (result.ok ? 0 : 1) } : prev));
      }
    };
    await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, pending.length) }, () => worker()));
    setImageJob((prev) => (prev && prev.done >= prev.total ? null : prev));
    if (failed > 0) setStatus({ kind: "error", text: `${failed} image${failed === 1 ? "" : "s"} couldn't be generated. Use the AI button to retry.` });
  };

  const handleGenerateDraft = async () => {
    setGenerating(true);
    setStatus(null);
    const result = await generateVocabularyDraft(supabase, { topicId, extraInstructions: extra.trim() || null, wordCount: clampWordCount(Number(wordCount)) });
    setGenerating(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    const drafted = result.words.map((w) => toDraft({ ...w, imageUrl: null }, w.imagePrompt));
    setWords(drafted);
    setTaskCount(String(defaultTestTaskCount(drafted.length)));
    setTestSeed(0);
    if (!autoImages) {
      setStatus({ kind: "success", text: `Drafted ${drafted.length} words. Use the AI button on a word to illustrate it.` });
      return;
    }
    setStatus({ kind: "success", text: `Drafted ${drafted.length} words. Generating images…` });
    void runBackgroundImages(drafted.map((w) => ({ key: w.key, word: w.word, imagePrompt: w.imagePrompt })));
  };

  const handleImport = async (sourceTopicId: string) => {
    setImporting(true);
    setStatus(null);
    const result = await copyVocabularyFromTopic(supabase, sourceTopicId);
    setImporting(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    const copied = result.words.map((w) => toDraft(w));
    setWords(copied);
    setTaskCount(String(result.taskCount > 0 ? result.taskCount : defaultTestTaskCount(copied.length)));
    setTestSeed(0);
    setStatus({ kind: "success", text: `Copied ${copied.length} words. Review and publish.` });
  };

  const handleGenerateImage = async (word: DraftWord) => {
    if (busyImages.has(word.key)) return;
    setImageBusy(word.key, true);
    // A word that already has a picture wants a different one — skip the shared cache.
    const result = await generateWordImage(supabase, { topicId, word: word.word, imagePrompt: word.imagePrompt, forceRegenerate: Boolean(word.imageUrl) });
    setImageBusy(word.key, false);
    if (!result.ok) setStatus({ kind: "error", text: result.error });
    else patchWord(word.key, { imageUrl: result.imageUrl });
  };

  const handleUploadImage = async (word: DraftWord) => {
    setImageBusy(word.key, true);
    const result = await pickAndUploadImage("homework");
    setImageBusy(word.key, false);
    if (result.kind === "uploaded") patchWord(word.key, { imageUrl: result.url });
    else if (result.kind === "denied" || result.kind === "failed") setStatus({ kind: "error", text: result.error });
  };

  const handlePublish = async () => {
    if (!words.some((w) => w.word.trim() && w.translation.trim())) {
      setStatus({ kind: "error", text: "Add at least one word with a translation first." });
      return;
    }
    setPublishing(true);
    setStatus(null);
    const result = await publishVocabulary(supabase, { topicId, words, taskCount: taskCountValue, testSeed });
    setPublishing(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    setPublishedSig(publishSignature(words, taskCountValue, testSeed));
    setHasPublished(true);
    setStatus({ kind: "success", text: "Vocabulary published to this topic." });
    void refresh();
  };

  const handleClear = () =>
    Alert.alert("Remove all vocabulary words and the test from this topic?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setPublishing(true);
          const result = await clearVocabulary(supabase, topicId);
          setPublishing(false);
          if (!result.ok) {
            setStatus({ kind: "error", text: result.error });
            return;
          }
          setWords([]);
          setHasPublished(false);
          setPublishedSig(publishSignature([], taskCountValue, testSeed));
          setStatus({ kind: "success", text: "Vocabulary removed from this topic." });
          void refresh();
        },
      },
    ]);

  return (
    <View style={styles.manager}>
      <View style={styles.panel}>
        <SlayText variant="label" color={alpha.white50}>
          Generate with AI
        </SlayText>
        <View style={styles.pair}>
          <NumberField label="Words" value={wordCount} onChange={setWordCount} />
          <NumberField label="Test tasks" value={taskCount} onChange={setTaskCount} />
        </View>
        <View style={styles.numberField}>
          <SlayText variant="label" color={alpha.white50} style={styles.plain}>
            Extra instructions (optional)
          </SlayText>
          <TextInput
            value={extra}
            onChangeText={setExtra}
            placeholder="e.g. beginner level, only nouns"
            placeholderTextColor={alpha.white40}
            accessibilityLabel="Extra instructions"
            autoCapitalize="sentences"
            autoCorrect
            spellCheck
            selectionColor={colors.neonPink}
            style={styles.input}
          />
        </View>
        <View style={styles.toggle}>
          <View style={styles.shrink}>
            <SlayText variant="small" weight="600">
              Generate images for all words
            </SlayText>
            <SlayText variant="label" color={alpha.white40} style={styles.plain}>
              Off — words come without pictures; add one per word with its AI button.
            </SlayText>
          </View>
          <Switch
            value={autoImages}
            onValueChange={setAutoImages}
            disabled={busy}
            accessibilityLabel="Generate images for all words"
            trackColor={{ false: alpha.white20, true: colors.limeGreen }}
            thumbColor={colors.white}
          />
        </View>
        <SlayButton variant="pink" size="sm" loading={generating} disabled={busy} onPress={() => void handleGenerateDraft()}>
          {words.length > 0 ? "Regenerate Words with AI" : "Generate Words with AI"}
        </SlayButton>
      </View>

      <TopicContentImporter sources={reuseSources} kind="vocabulary" disabled={busy} loading={importing} onImport={(id) => void handleImport(id)} />

      {words.map((w, index) => (
        <VocabWordEditor
          key={w.key}
          word={w}
          index={index}
          imageBusy={busyImages.has(w.key)}
          onChange={(patch) => patchWord(w.key, patch)}
          onRemove={() => setWords((prev) => prev.filter((x) => x.key !== w.key))}
          onGenerateImage={() => void handleGenerateImage(w)}
          onUploadImage={() => void handleUploadImage(w)}
        />
      ))}

      <SlayButton variant="ghost" size="sm" disabled={busy || words.length >= MAX_VOCAB_WORDS} onPress={() => setWords((prev) => [...prev, blankDraft()])}>
        + Add word manually
      </SlayButton>

      {words.length > 0 ? (
        <View style={styles.panel}>
          <View style={styles.previewHead}>
            <SlayText variant="label" color={alpha.white50}>
              Test preview ({previewTasks.length} task{previewTasks.length === 1 ? "" : "s"})
            </SlayText>
            <View style={styles.previewButtons}>
              <SlayPressable
                accessibilityRole="button"
                disabled={busy || previewTasks.length === 0}
                onPress={() => setPreviewOpen(true)}
                style={[styles.small, styles.smallCyan, (busy || previewTasks.length === 0) && styles.dim]}
              >
                <SlayText variant="label" weight="700" color={colors.cyan} style={styles.smallText}>
                  Try the test
                </SlayText>
              </SlayPressable>
              <SlayPressable
                accessibilityRole="button"
                disabled={busy || previewTasks.length === 0}
                onPress={() => setTestSeed((s) => s + 1)}
                style={[styles.small, styles.smallPurple, (busy || previewTasks.length === 0) && styles.dim]}
              >
                <SlayText variant="label" weight="700" style={styles.smallText}>
                  Regenerate test
                </SlayText>
              </SlayPressable>
            </View>
          </View>
          {previewTasks.length === 0 ? (
            <SlayText variant="label" color={alpha.white40} style={styles.plain}>
              {taskCountValue === 0 ? "Test tasks set to 0 — no test will be built." : "Add a word with a translation to build the test."}
            </SlayText>
          ) : (
            previewTasks.map((task, i) => {
              const { label, detail } = describeVocabTask(task.taskType, task.content);
              return (
                <View key={i} style={styles.taskLine}>
                  <View style={styles.taskLabel}>
                    <SlayText variant="label" weight="700" style={styles.smallText}>
                      {label}
                    </SlayText>
                  </View>
                  <SlayText variant="small" color={alpha.white60} numberOfLines={1} style={styles.shrink}>
                    {detail}
                  </SlayText>
                </View>
              );
            })
          )}
          <SlayText variant="label" color={withAlpha(colors.white, 0.3)} style={styles.plain}>
            Publishing replaces this topic&apos;s current test with the one above. &quot;Try the test&quot; plays it exactly as a student would, without saving anything.
          </SlayText>
        </View>
      ) : null}

      <TestPreviewRunner open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview — Vocabulary test" tasks={previewTasks} />

      {status ? (
        <SlayText
          variant="small"
          weight="600"
          color={status.kind === "error" ? colors.neonPink : colors.limeGreen}
          accessibilityRole={status.kind === "error" ? "alert" : undefined}
          accessibilityLiveRegion="polite"
        >
          {status.text}
        </SlayText>
      ) : null}

      <View style={styles.actions}>
        <SlayButton
          variant="green"
          style={styles.grow}
          loading={publishing}
          disabled={busy || busyImages.size > 0 || words.length === 0 || !dirty}
          onPress={() => void handlePublish()}
        >
          {dirty ? "Publish to Topic" : "Published"}
        </SlayButton>
        {hasPublished ? (
          <SlayButton variant="ghost" disabled={busy} onPress={handleClear}>
            Clear
          </SlayButton>
        ) : null}
      </View>
      {busyImages.size > 0 ? (
        <SlayText variant="label" color={alpha.white40} style={[styles.plain, styles.center]}>
          Finish generating images before publishing…
        </SlayText>
      ) : null}

      {imageJob && imageJob.total > 0 ? (
        <View style={styles.job} accessibilityRole="progressbar" accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.purple} />
          <View style={styles.shrink}>
            <SlayText variant="small" weight="600">
              Generating word images… {Math.min(imageJob.done + 1, imageJob.total)}/{imageJob.total}
            </SlayText>
            {imageJob.failed > 0 ? (
              <SlayText variant="label" color={colors.neonPink} style={styles.plain}>
                {imageJob.failed} failed — use the AI button to retry
              </SlayText>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  manager: { gap: 16 },
  panel: { gap: 12, borderRadius: radii.md, borderWidth: 1, borderColor: alpha.white10, backgroundColor: withAlpha(colors.black, 0.3), padding: 12 },
  pair: { flexDirection: "row", gap: 12 },
  numberField: { flex: 1, gap: 4 },
  plain: { textTransform: "none", letterSpacing: 0 },
  input: {
    minWidth: 0,
    minHeight: 40,
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
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: radii.md, borderWidth: 1, borderColor: alpha.white15, backgroundColor: alpha.white5, paddingHorizontal: 12, paddingVertical: 10 },
  shrink: { flexShrink: 1, minWidth: 0 },
  previewHead: { gap: 8 },
  previewButtons: { flexDirection: "row", gap: 6 },
  small: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  smallCyan: { borderWidth: 1, borderColor: withAlpha(colors.cyan, 0.6) },
  smallPurple: { backgroundColor: withAlpha(colors.purple, 0.8) },
  smallText: { fontSize: 10 },
  dim: { opacity: 0.4 },
  taskLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  taskLabel: { borderRadius: 4, backgroundColor: withAlpha(colors.purple, 0.25), paddingHorizontal: 6, paddingVertical: 2 },
  actions: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
  center: { textAlign: "center" },
  job: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radii.md, borderWidth: 1, borderColor: withAlpha(colors.purple, 0.5), backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12 },
});
