import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from "react-native";

import type { HomeworkTopicData, HomeworkTopicNote } from "@slay/data";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";

import { GrammarCard, WordCard } from "./StudyCards";
import { StudyFlow } from "./StudyFlow";
import { TopicChat } from "./TopicChat";

function TopicNoteCard({ note }: { note: HomeworkTopicNote }) {
  const picture = imageSource(note.imageUrl);
  if (!note.text && !note.linkUrl && !picture) return null;
  return (
    <View style={styles.card}>
      {picture ? <Image source={picture} style={styles.noteImage} resizeMode="cover" accessible={false} /> : null}
      {note.text ? (
        <SlayText variant="small" color={alpha.white70}>
          {note.text}
        </SlayText>
      ) : null}
      {note.linkUrl ? (
        <SlayPressable accessibilityRole="link" onPress={() => Linking.openURL(note.linkUrl!)}>
          <SlayText variant="small" weight="700" color={colors.cyan} numberOfLines={1}>
            {note.linkUrl}
          </SlayText>
        </SlayPressable>
      ) : null}
    </View>
  );
}

/** One learning-module card on the topic: vocabulary or grammar. */
function ModuleCard({ title, subtitle, passed, onPress }: { title: string; subtitle: string; passed: boolean; onPress: () => void }) {
  return (
    <SlayPressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}${passed ? ", passed" : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.module, pressed && styles.modulePressed]}
    >
      <View style={styles.shrink}>
        <SlayText variant="bodyStrong">{title}</SlayText>
        <SlayText variant="small" color={alpha.white50}>
          {subtitle}
        </SlayText>
      </View>
      <View style={[styles.pill, passed ? styles.pillPassed : styles.pillStart]}>
        <SlayText variant="label" weight="700" color={passed ? colors.limeGreen : colors.cyan}>
          {passed ? "Passed ✓" : "Start"}
        </SlayText>
      </View>
    </SlayPressable>
  );
}

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"} + test`;

/**
 * Port of upstream's `HomeworkTopicScreen.tsx`: one homework topic — the
 * teacher's note, up to two learning modules (Learn the Words, Learn the
 * Grammar), each opening its own full-screen flow, and the group's Q&A
 * thread. Homework grants no coins; a first pass of a module grants XP.
 */
export function HomeworkTopicScreen({ topic, note, currentUserId, messages, vocab, grammar }: HomeworkTopicData) {
  const router = useRouter();
  const [mode, setMode] = useState<"intro" | "vocab" | "grammar">("intro");
  const back = () => router.navigate("/homework");

  if (mode === "vocab" && vocab) {
    return (
      <StudyFlow
        kind="vocab"
        topicId={topic.id}
        topicTitle={topic.title}
        cards={vocab.words}
        tasks={vocab.tasks}
        alreadyPassed={vocab.passed}
        onExit={() => setMode("intro")}
        renderCard={(word, onNext, actionLabel) => <WordCard word={word} onNext={onNext} actionLabel={actionLabel} />}
      />
    );
  }

  if (mode === "grammar" && grammar) {
    return (
      <StudyFlow
        kind="grammar"
        topicId={topic.id}
        topicTitle={topic.title}
        cards={grammar.points}
        tasks={grammar.tasks}
        alreadyPassed={grammar.passed}
        onExit={() => setMode("intro")}
        renderCard={(point, onNext, actionLabel) => <GrammarCard point={point} onNext={onNext} actionLabel={actionLabel} />}
      />
    );
  }

  return (
    <AppContainer>
      {/* The chat's field sits at the bottom; on iOS the page shrinks above the keyboard. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <SlayPressable accessibilityRole="button" onPress={back} hitSlop={8} style={styles.back}>
              <SlayText variant="small" color={alpha.white50}>
                ← Homework
              </SlayText>
            </SlayPressable>
            <SlayText variant="h2" weight="900" accessibilityRole="header">
              {topic.title}
            </SlayText>
            {topic.description ? (
              <SlayText variant="small" color={alpha.white60}>
                {topic.description}
              </SlayText>
            ) : null}
          </View>

          <TopicNoteCard note={note} />

          {vocab ? (
            <ModuleCard
              title="Learn the Words"
              subtitle={plural(vocab.words.length, "word")}
              passed={vocab.passed}
              onPress={() => setMode("vocab")}
            />
          ) : null}
          {grammar ? (
            <ModuleCard
              title="Learn the Grammar"
              subtitle={plural(grammar.points.length, "rule")}
              passed={grammar.passed}
              onPress={() => setMode("grammar")}
            />
          ) : null}
          {!vocab && !grammar ? (
            <View style={[styles.card, styles.emptyCard]}>
              <SlayText variant="small" color={alpha.white60} style={styles.center}>
                This topic has nothing to study yet.
              </SlayText>
              <SlayButton variant="ghost" size="sm" onPress={back}>
                Back to Homework
              </SlayButton>
            </View>
          ) : null}

          <View style={styles.qa}>
            <SlayText variant="label" color={alpha.white50} accessibilityRole="header">
              Q&amp;A
            </SlayText>
            <SlayText variant="small" color={alpha.white50}>
              Ask your teacher or leave a note — everyone in your group can see it.
            </SlayText>
            <TopicChat topicId={topic.id} currentUserId={currentUserId} initialMessages={messages} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { gap: 16, paddingTop: 32, paddingBottom: 24 },
  header: { gap: 4 },
  back: { alignSelf: "flex-start", marginBottom: 4 },
  center: { textAlign: "center" },
  shrink: { flexShrink: 1, gap: 2 },
  card: {
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyCard: { alignItems: "center", paddingVertical: 24 },
  noteImage: { width: "100%", aspectRatio: 16 / 9, borderRadius: radii.md },
  module: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.cyan, 0.3),
    backgroundColor: withAlpha(colors.cyan, 0.05),
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modulePressed: { borderColor: withAlpha(colors.cyan, 0.5) },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  pillPassed: { backgroundColor: withAlpha(colors.limeGreen, 0.15) },
  pillStart: { backgroundColor: withAlpha(colors.cyan, 0.15) },
  qa: { gap: 8, marginTop: 8 },
});
