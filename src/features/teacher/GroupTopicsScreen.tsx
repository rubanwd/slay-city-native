import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { deleteHomeworkTopic, type GroupTopicsData, type TeacherTopicSummary } from "@slay/data";
import { alpha, colors, radii } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayPressable, SlayText } from "~/components/ui";
import { UnreadBadge } from "~/features/homework";
import { supabase } from "~/lib/supabase";

import { FormSheet } from "./FormSheet";
import { TEACHER_DASHBOARD_QUERY_KEY, TEACHER_GROUP_QUERY_KEY } from "./queryKeys";
import { TeacherHeader } from "./TeacherHeader";
import { TopicForm } from "./TopicForm";

export interface GroupTopicsScreenProps extends GroupTopicsData {
  refreshing?: boolean;
  onRefresh?: () => void;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function TopicCard({ groupId, topic, onEdit }: { groupId: string; topic: TeacherTopicSummary; onEdit: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteHomeworkTopic(supabase, topic.id),
    onSuccess: async (result) => {
      if (!result.ok) {
        Alert.alert("Couldn't delete the topic", result.error);
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [TEACHER_GROUP_QUERY_KEY, groupId] }),
        queryClient.invalidateQueries({ queryKey: [TEACHER_DASHBOARD_QUERY_KEY] }),
      ]);
    },
  });
  const hasExtra = Boolean(topic.noteText || topic.noteLinkUrl || topic.noteImageUrl);

  const confirmDelete = () =>
    Alert.alert("Delete this topic?", "Its words, rules, test and Q&A go with it. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
    ]);

  return (
    <View style={styles.card}>
      <SlayPressable
        accessibilityRole="link"
        accessibilityLabel={`${topic.title}. ${plural(topic.wordCount, "word", "words")}, ${plural(topic.grammarCount, "rule", "rules")}${
          topic.unreadCount > 0 ? `. ${topic.unreadCount} unread` : ""
        }`}
        onPress={() => router.push({ pathname: "/teacher/groups/[groupId]/topics/[topicId]", params: { groupId, topicId: topic.id } })}
      >
        <View style={styles.titleRow}>
          <SlayText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
            {topic.title}
          </SlayText>
          <UnreadBadge count={topic.unreadCount} />
        </View>
        {topic.description ? (
          <SlayText variant="small" color={alpha.white50} numberOfLines={1}>
            {topic.description}
          </SlayText>
        ) : null}
        <View style={styles.counts}>
          <SlayText variant="label" weight="700" color={colors.cyan}>
            {plural(topic.wordCount, "word", "words")} · {plural(topic.grammarCount, "rule", "rules")}
          </SlayText>
          {hasExtra ? (
            <SlayText variant="label" color={alpha.white50} accessibilityLabel="Has extra info for students">
              📎
            </SlayText>
          ) : null}
        </View>
      </SlayPressable>
      <View style={styles.buttons}>
        <SlayPressable accessibilityRole="button" accessibilityLabel={`Edit ${topic.title}`} onPress={onEdit} style={[styles.pill, styles.pillEdit]}>
          <SlayText variant="label" weight="700" color={alpha.white60}>
            Edit
          </SlayText>
        </SlayPressable>
        <SlayPressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${topic.title}`}
          disabled={remove.isPending}
          onPress={confirmDelete}
          style={[styles.pill, styles.pillDelete, remove.isPending && styles.dim]}
        >
          <SlayText variant="label" weight="700" color={colors.neonPink}>
            Delete
          </SlayText>
        </SlayPressable>
      </View>
    </View>
  );
}

/**
 * Port of upstream's `src/app/teacher/groups/[groupId]/page.tsx`: a group's
 * lesson topics, newest first — add one, edit or delete it, or open it to
 * author its content and answer its Q&A.
 */
export function GroupTopicsScreen({ group, topics, nextOrder, refreshing = false, onRefresh }: GroupTopicsScreenProps) {
  const [sheet, setSheet] = useState<{ kind: "create" } | { kind: "edit"; topic: TeacherTopicSummary } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const close = () => setSheet(null);

  return (
    <AppContainer edges={["top"]}>
      <FlatList
        data={topics}
        keyExtractor={(topic) => topic.id}
        renderItem={({ item }) => <TopicCard groupId={group.id} topic={item} onEdit={() => setSheet({ kind: "edit", topic: item })} />}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <TeacherHeader title={group.name} backHref="/teacher" />
            <SlayText variant="label" color={alpha.white50} style={styles.heading}>
              Lesson Topics ({topics.length})
            </SlayText>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <SlayText variant="small" color={alpha.white50} style={styles.center}>
              No topics yet. Add the first one below.
            </SlayText>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {notice ? (
              <SlayText variant="small" weight="600" color={colors.limeGreen} accessibilityLiveRegion="polite" style={styles.center}>
                {notice}
              </SlayText>
            ) : null}
            <SlayButton variant="green" onPress={() => setSheet({ kind: "create" })}>
              Add Topic
            </SlayButton>
          </View>
        }
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.limeGreen} /> : undefined}
      />

      {sheet ? (
        <FormSheet title={sheet.kind === "create" ? "Add Lesson Topic" : "Edit Lesson Topic"} onClose={close}>
          <TopicForm
            mode={sheet.kind === "create" ? { kind: "create", groupId: group.id, nextOrder } : { kind: "edit", groupId: group.id, topic: sheet.topic }}
            onSaved={(message) => {
              setNotice(message);
              close();
            }}
            onCancel={close}
          />
        </FormSheet>
      ) : null}
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 32 },
  heading: { marginBottom: 8 },
  gap: { height: 8 },
  center: { textAlign: "center" },
  shrink: { flexShrink: 1 },
  card: { gap: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: alpha.white10, backgroundColor: colors.surface, padding: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  counts: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  buttons: { flexDirection: "row", gap: 8 },
  pill: { flex: 1, alignItems: "center", borderRadius: 999, borderWidth: 1, paddingVertical: 6 },
  pillEdit: { borderColor: alpha.white20 },
  pillDelete: { borderColor: colors.neonPink },
  dim: { opacity: 0.5 },
  empty: { borderRadius: radii.lg, borderWidth: 1, borderColor: alpha.white10, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 24 },
  footer: { gap: 12, marginTop: 24 },
});
