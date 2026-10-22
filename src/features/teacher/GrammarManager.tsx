import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import {
  clampGrammarPointCount,
  defaultGrammarTaskCount,
  describeGrammarTask,
  MAX_GRAMMAR_POINTS,
  type GrammarDraftTask,
  type TopicSource,
} from "@slay/core";
import { clearGrammar, copyGrammarFromTopic, generateGrammarDraft, publishGrammar, type TeacherGrammarPoint } from "@slay/data";
import { alpha } from "@slay/tokens";

import { SlayButton, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

import { authoringStyles, CountField, SmallField, StatusLine, TestPreviewPanel, type Status } from "./AuthoringParts";
import { GrammarPointEditor, type DraftGrammarPoint } from "./GrammarPointEditor";
import { TEACHER_DASHBOARD_QUERY_KEY, TEACHER_GROUP_QUERY_KEY, TEACHER_TOPIC_QUERY_KEY } from "./queryKeys";
import { TestPreviewRunner } from "./TestPreviewRunner";
import { TopicContentImporter } from "./TopicContentImporter";

export interface GrammarManagerProps {
  topicId: string;
  groupId: string;
  initialPoints: TeacherGrammarPoint[];
  /** The published test, for the preview and the baseline. */
  initialTasks: GrammarDraftTask[];
  /** This teacher's other topics with grammar, to copy from. */
  reuseSources: TopicSource[];
}

let keySeq = 0;
const nextKey = () => `g${keySeq++}`;

const toDraft = (p: { title: string; explanation: string; example: string | null }): DraftGrammarPoint => ({
  key: nextKey(),
  title: p.title,
  explanation: p.explanation,
  example: p.example ?? "",
});

/** Everything Publish sends — points and test — compared with the last publish. */
function publishSignature(points: Pick<DraftGrammarPoint, "title" | "explanation" | "example">[], tasks: GrammarDraftTask[]): string {
  return `${points.map((p) => [p.title, p.explanation, p.example].join("\u0001")).join("\u0002")}|${tasks
    .map((t) => `${t.taskType}:${JSON.stringify(t.content)}`)
    .join("\u0002")}`;
}

/**
 * Port of upstream's `teacher/GrammarManager.tsx`, the sibling of
 * `VocabularyManager`: a topic's rules (title, explanation, example) and a
 * test. A grammar test can't be built from the rules, so it comes from the AI
 * draft or a copied topic; Regenerate test re-drafts only the test, keeping
 * the teacher's edited rules. Nothing touches the database until Publish.
 *
 * The AI calls go to the WP-5.6 `draft-grammar` Edge Function; until it is
 * deployed they fail with a readable message, and the teacher writes rules by
 * hand or copies a topic (whose test comes with it).
 */
export function GrammarManager({ topicId, groupId, initialPoints, initialTasks, reuseSources }: GrammarManagerProps) {
  const queryClient = useQueryClient();
  const [points, setPoints] = useState<DraftGrammarPoint[]>(() => initialPoints.map(toDraft));
  const [tasks, setTasks] = useState<GrammarDraftTask[]>(initialTasks);
  const [pointCount, setPointCount] = useState(String(initialPoints.length || 5));
  const [taskCount, setTaskCount] = useState(String(initialTasks.length > 0 ? initialTasks.length : defaultGrammarTaskCount(initialPoints.length)));
  const [extra, setExtra] = useState("");
  const [publishedSig, setPublishedSig] = useState(() => publishSignature(initialPoints.map(toDraft), initialTasks));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasPublished, setHasPublished] = useState(initialPoints.length > 0);
  const [status, setStatus] = useState<Status>(null);

  const busy = generating || regenerating || importing || publishing;
  const pointCountValue = clampGrammarPointCount(Number(pointCount));
  const taskCountValue = Math.max(0, Math.round(Number(taskCount) || 0));
  const dirty = publishSignature(points, tasks) !== publishedSig;

  const patchPoint = (key: string, patch: Partial<DraftGrammarPoint>) => setPoints((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [TEACHER_TOPIC_QUERY_KEY, topicId] }),
      queryClient.invalidateQueries({ queryKey: [TEACHER_GROUP_QUERY_KEY, groupId] }),
      queryClient.invalidateQueries({ queryKey: [TEACHER_DASHBOARD_QUERY_KEY] }),
    ]);

  const draft = () => generateGrammarDraft(supabase, { topicId, extraInstructions: extra.trim() || null, pointCount: pointCountValue, taskCount: taskCountValue });

  const handleGenerate = async () => {
    setGenerating(true);
    setStatus(null);
    const result = await draft();
    setGenerating(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    setPoints(result.points.map(toDraft));
    setTasks(result.tasks);
    setTaskCount(String(result.tasks.length || defaultGrammarTaskCount(result.points.length)));
    setStatus({ kind: "success", text: `Drafted ${result.points.length} grammar points and ${result.tasks.length} test tasks.` });
  };

  const handleRegenerateTest = async () => {
    setRegenerating(true);
    setStatus(null);
    // Re-draft, keeping only the fresh test — the teacher's edited rules stay.
    const result = await draft();
    setRegenerating(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    setTasks(result.tasks);
    setStatus({ kind: "success", text: `Regenerated ${result.tasks.length} test tasks.` });
  };

  const handleImport = async (sourceTopicId: string) => {
    setImporting(true);
    setStatus(null);
    const result = await copyGrammarFromTopic(supabase, sourceTopicId);
    setImporting(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    setPoints(result.points.map(toDraft));
    setTasks(result.tasks);
    setTaskCount(String(result.tasks.length || defaultGrammarTaskCount(result.points.length)));
    setStatus({ kind: "success", text: `Copied ${result.points.length} grammar points and ${result.tasks.length} test tasks. Review and publish.` });
  };

  const handlePublish = async () => {
    const ready = points.filter((p) => p.title.trim() && p.explanation.trim());
    if (ready.length === 0) {
      setStatus({ kind: "error", text: "Add at least one grammar point with an explanation first." });
      return;
    }
    setPublishing(true);
    setStatus(null);
    const result = await publishGrammar(supabase, {
      topicId,
      points: ready.map((p) => ({ title: p.title, explanation: p.explanation, example: p.example.trim() || null })),
      tasks,
    });
    setPublishing(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    setPublishedSig(publishSignature(points, tasks));
    setHasPublished(true);
    setStatus({ kind: "success", text: "Grammar published to this topic." });
    void refresh();
  };

  const handleClear = () =>
    Alert.alert("Remove all grammar points and the test from this topic?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setPublishing(true);
          const result = await clearGrammar(supabase, topicId);
          setPublishing(false);
          if (!result.ok) {
            setStatus({ kind: "error", text: result.error });
            return;
          }
          setPoints([]);
          setTasks([]);
          setHasPublished(false);
          setPublishedSig(publishSignature([], []));
          setStatus({ kind: "success", text: "Grammar removed from this topic." });
          void refresh();
        },
      },
    ]);

  return (
    <View style={styles.manager}>
      <View style={authoringStyles.panel}>
        <SlayText variant="label" color={alpha.white50}>
          Generate with AI
        </SlayText>
        <View style={styles.pair}>
          <CountField label="Rule points" value={pointCount} onChange={setPointCount} />
          <CountField label="Test tasks" value={taskCount} onChange={setTaskCount} />
        </View>
        <SmallField
          label="Extra instructions (optional)"
          value={extra}
          onChangeText={setExtra}
          placeholder="e.g. beginner level, focus on past tense"
          autoCapitalize="sentences"
          autoCorrect
          spellCheck
        />
        <SlayButton variant="pink" size="sm" loading={generating} disabled={busy} onPress={() => void handleGenerate()}>
          {points.length > 0 ? "Regenerate Grammar with AI" : "Generate Grammar with AI"}
        </SlayButton>
      </View>

      <TopicContentImporter sources={reuseSources} kind="grammar" disabled={busy} loading={importing} onImport={(id) => void handleImport(id)} />

      {points.map((p, index) => (
        <GrammarPointEditor
          key={p.key}
          point={p}
          index={index}
          onChange={(patch) => patchPoint(p.key, patch)}
          onRemove={() => setPoints((prev) => prev.filter((x) => x.key !== p.key))}
        />
      ))}

      <SlayButton
        variant="ghost"
        size="sm"
        disabled={busy || points.length >= MAX_GRAMMAR_POINTS}
        onPress={() => setPoints((prev) => [...prev, toDraft({ title: "", explanation: "", example: null })])}
      >
        + Add point manually
      </SlayButton>

      {points.length > 0 ? (
        <TestPreviewPanel
          count={tasks.length}
          empty="No test yet — generate with AI or set test tasks above."
          lines={tasks.map((task) => describeGrammarTask(task.taskType, task.content))}
          busy={busy}
          onTry={() => setPreviewOpen(true)}
          onRegenerate={() => void handleRegenerateTest()}
          regenerateLabel={regenerating ? "Regenerating…" : "Regenerate test"}
          regenerateNeedsTasks={false}
          footnote={'Publishing replaces this topic\'s current grammar test with the one above. "Try the test" plays it exactly as a student would, without saving anything.'}
        />
      ) : null}

      <TestPreviewRunner open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview — Grammar test" tasks={tasks} />

      <StatusLine status={status} />

      <View style={styles.actions}>
        <SlayButton variant="green" style={styles.grow} loading={publishing} disabled={busy || points.length === 0 || !dirty} onPress={() => void handlePublish()}>
          {dirty ? "Publish to Topic" : "Published"}
        </SlayButton>
        {hasPublished ? (
          <SlayButton variant="ghost" disabled={busy} onPress={handleClear}>
            Clear
          </SlayButton>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  manager: { gap: 16 },
  pair: { flexDirection: "row", gap: 12 },
  actions: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
});
