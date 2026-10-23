import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import type { TeacherTopicData } from "@slay/data";
import { alpha, colors, radii } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayText } from "~/components/ui";
import { TopicChat, UnreadBadge } from "~/features/homework";

import { CollapsibleSection } from "./CollapsibleSection";
import { Completions } from "./Completions";
import { TopicForm } from "./TopicForm";
import { TeacherHeader } from "./TeacherHeader";

export interface TeacherTopicScreenProps extends TeacherTopicData {
  refreshing?: boolean;
  onRefresh?: () => void;
  /** The vocabulary editor (WP-5.3); without one, the published words are listed read-only. */
  vocabularyEditor?: ReactNode;
  /** The grammar editor (WP-5.4); without one, the published rules are listed read-only. */
  grammarEditor?: ReactNode;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function ReadOnlyList({ empty, lines, summary }: { empty: string; lines: { key: string; main: string; sub?: string | null }[]; summary: string }) {
  if (lines.length === 0) {
    return (
      <SlayText variant="small" color={alpha.white50}>
        {empty}
      </SlayText>
    );
  }
  return (
    <View style={styles.readOnly}>
      <SlayText variant="label" weight="700" color={colors.cyan}>
        {summary}
      </SlayText>
      {lines.map((line) => (
        <View key={line.key} style={styles.line}>
          <SlayText variant="small" weight="700">
            {line.main}
          </SlayText>
          {line.sub ? (
            <SlayText variant="small" color={alpha.white50}>
              {line.sub}
            </SlayText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * Port of upstream's `src/app/teacher/groups/[groupId]/topics/[topicId]/page.tsx`:
 * one topic — its info, its Vocabulary and Grammar modules with who has passed
 * each, and the group's Q&A thread, each in a collapsible section.
 */
export function TeacherTopicScreen({
  group,
  topic,
  teacherId,
  vocabWords,
  vocabTaskCount,
  grammarPoints,
  grammarTasks,
  vocabRows,
  grammarRows,
  messages,
  unreadCount,
  refreshing = false,
  onRefresh,
  vocabularyEditor,
  grammarEditor,
}: TeacherTopicScreenProps) {
  const [unread, setUnread] = useState(unreadCount);

  return (
    <AppContainer edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.fill}>
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.limeGreen} /> : undefined}
        >
          <TeacherHeader title={topic.title} backHref={{ pathname: "/teacher/groups/[groupId]", params: { groupId: group.id } }} />

          <CollapsibleSection title="Topic Info" subtitle="Title, description and extra info students see before starting.">
            <TopicForm key={`${topic.title}:${topic.description}:${topic.noteLinkUrl}:${topic.noteImageUrl}`} mode={{ kind: "edit", groupId: group.id, topic }} />
          </CollapsibleSection>

          <CollapsibleSection title="Vocabulary Learning" subtitle="Words the group learns as flashcards, plus an auto-built test to check them.">
            {vocabularyEditor ?? (
              <ReadOnlyList
                empty="No vocabulary yet."
                summary={`${plural(vocabWords.length, "word", "words")} · ${plural(vocabTaskCount, "test task", "test tasks")}`}
                lines={vocabWords.map((w, i) => ({ key: `${i}:${w.word}`, main: w.word, sub: [w.transcription, w.translation].filter(Boolean).join(" · ") }))}
              />
            )}
            <Completions title="Vocabulary Passed" rows={vocabRows} />
          </CollapsibleSection>

          <CollapsibleSection title="Grammar Learning" subtitle="Grammar rules the group studies as cards, plus an AI-built test to check them.">
            {grammarEditor ?? (
              <ReadOnlyList
                empty="No grammar yet."
                summary={`${plural(grammarPoints.length, "rule", "rules")} · ${plural(grammarTasks.length, "test task", "test tasks")}`}
                lines={grammarPoints.map((p, i) => ({ key: `${i}:${p.title}`, main: p.title, sub: p.explanation }))}
              />
            )}
            <Completions title="Grammar Passed" rows={grammarRows} />
          </CollapsibleSection>

          <CollapsibleSection
            title="Q&A"
            subtitle={`Shared thread — questions and answers are visible to everyone in ${group.name}.`}
            badge={<UnreadBadge count={unread} />}
            onOpen={() => setUnread(0)}
          >
            <TopicChat topicId={topic.id} currentUserId={teacherId} initialMessages={messages} />
          </CollapsibleSection>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { paddingBottom: 32 },
  readOnly: { gap: 8 },
  line: { borderRadius: radii.md, borderWidth: 1, borderColor: alpha.white10, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8 },
});
