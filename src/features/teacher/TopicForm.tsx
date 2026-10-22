import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { createTopic, updateTopic, type TeacherTopicRow, type TopicFormInput } from "@slay/data";
import { alpha, colors, radii } from "@slay/tokens";

import { SlayButton, SlayInput, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

import { ImageUploadField } from "./ImageUploadField";
import { TEACHER_DASHBOARD_QUERY_KEY, TEACHER_GROUP_QUERY_KEY, TEACHER_TOPIC_QUERY_KEY } from "./queryKeys";

export type TopicFormMode =
  | { kind: "create"; groupId: string; nextOrder: number }
  | { kind: "edit"; groupId: string; topic: TeacherTopicRow };

export interface TopicFormProps {
  mode: TopicFormMode;
  /** Called with a confirmation line once the topic is saved. */
  onSaved?: (message: string) => void;
  /** Shows a Cancel button when set. */
  onCancel?: () => void;
}

/**
 * Port of upstream's `HomeworkTopicForm.tsx` (create) and the edit form inside
 * `HomeworkTopicItem.tsx`: title, optional description, and the optional link
 * and picture students see before starting. Saving goes through
 * `create_homework_topic` / `update_homework_topic`, which re-check that the
 * group is this teacher's.
 */
export function TopicForm({ mode, onSaved, onCancel }: TopicFormProps) {
  const queryClient = useQueryClient();
  const initial = mode.kind === "edit" ? mode.topic : null;
  const [form, setForm] = useState<TopicFormInput>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    noteLinkUrl: initial?.noteLinkUrl ?? "",
    noteImageUrl: initial?.noteImageUrl ?? "",
  });
  const [uploading, setUploading] = useState(false);
  const set = (key: keyof TopicFormInput) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      mode.kind === "create"
        ? createTopic(supabase, mode.groupId, form, mode.nextOrder)
        : updateTopic(supabase, mode.topic.id, form, mode.topic.orderIndex),
    onSuccess: async (result) => {
      if (!result.ok) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [TEACHER_GROUP_QUERY_KEY, mode.groupId] }),
        queryClient.invalidateQueries({ queryKey: [TEACHER_TOPIC_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [TEACHER_DASHBOARD_QUERY_KEY] }),
      ]);
      const title = form.title.trim();
      onSaved?.(mode.kind === "create" ? `Topic "${title}" added.` : `Topic "${title}" updated.`);
    },
  });
  const error = save.data && !save.data.ok ? save.data.error : save.error?.message;
  const busy = save.isPending || uploading;

  return (
    <View style={styles.form}>
      <SlayInput
        label="Topic Title"
        value={form.title}
        onChangeText={set("title")}
        autoFocus={mode.kind === "create"}
        autoCapitalize="sentences"
        autoCorrect
        spellCheck
        editable={!save.isPending}
      />
      <SlayInput
        label="Description (optional)"
        value={form.description}
        onChangeText={set("description")}
        multiline
        autoCapitalize="sentences"
        autoCorrect
        spellCheck
        editable={!save.isPending}
        style={styles.multiline}
      />
      {mode.kind === "create" ? (
        <View style={styles.note}>
          <SlayText variant="small" color={alpha.white50}>
            A shared Q&amp;A thread opens on this topic once it&apos;s created — you and the group can ask questions and leave notes there.
          </SlayText>
        </View>
      ) : null}
      <SlayInput
        label="Link (optional)"
        value={form.noteLinkUrl}
        onChangeText={set("noteLinkUrl")}
        placeholder="https://..."
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        editable={!save.isPending}
      />
      <ImageUploadField
        label="Image (optional)"
        folder="homework"
        value={form.noteImageUrl}
        onChange={set("noteImageUrl")}
        disabled={save.isPending}
        onUploadingChange={setUploading}
      />

      {error ? (
        <SlayText variant="small" weight="600" color={colors.neonPink} accessibilityRole="alert">
          {error}
        </SlayText>
      ) : null}

      <View style={styles.actions}>
        <SlayButton variant="green" style={styles.grow} loading={save.isPending} disabled={busy} onPress={() => save.mutate()}>
          {mode.kind === "create" ? "Add Topic" : "Save"}
        </SlayButton>
        {onCancel ? (
          <SlayButton variant="ghost" disabled={save.isPending} onPress={onCancel}>
            Cancel
          </SlayButton>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  multiline: { height: 96, textAlignVertical: "top" },
  note: { borderRadius: radii.md, borderWidth: 1, borderColor: alpha.white10, backgroundColor: alpha.white5, paddingHorizontal: 16, paddingVertical: 12 },
  actions: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
});
