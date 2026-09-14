/**
 * Topic content reuse — the shared, dependency-free part.
 *
 * The same homework topic (e.g. "Food", "Present Simple") is usually taught to
 * several groups. Rather than re-drafting the words or grammar rules for every
 * group, a teacher can pull the content of a topic they already published
 * somewhere else into the topic they are editing. These helpers turn the raw
 * rows behind that picker into the list the UI shows, and are kept free of
 * Supabase/React so they can be unit-tested on their own.
 */

/** Which learning module a reuse picker is offering. */
export type TopicContentKind = "vocabulary" | "grammar";

/** One topic a teacher can copy content from, with what it actually carries. */
export interface TopicSource {
  topicId: string;
  title: string;
  /** Name of the group the topic belongs to — how a teacher tells duplicates apart. */
  groupName: string;
  wordCount: number;
  pointCount: number;
}

/** A topic row as read from `homework_topics`. */
export interface TopicSourceRow {
  id: string;
  groupId: string;
  title: string;
  orderIndex: number;
}

export interface BuildTopicSourcesParams {
  topics: TopicSourceRow[];
  /** Group id → group name, for labelling each source. */
  groupNames: Map<string, string>;
  /** One entry per vocabulary word row (its topic id) — counted per topic. */
  vocabWordTopicIds: string[];
  /** One entry per grammar point row (its topic id) — counted per topic. */
  grammarPointTopicIds: string[];
  /** The topic being edited: never offered as a source for itself. */
  excludeTopicId?: string;
}

/** Tallies how many rows each topic id appears in. */
function countByTopic(topicIds: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of topicIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/**
 * Builds the reuse list: every topic that carries vocabulary or grammar,
 * excluding the one being edited, ordered by group name then by the topic's own
 * order so the picker reads like the teacher's own group list.
 */
export function buildTopicSources({
  topics,
  groupNames,
  vocabWordTopicIds,
  grammarPointTopicIds,
  excludeTopicId,
}: BuildTopicSourcesParams): TopicSource[] {
  const words = countByTopic(vocabWordTopicIds);
  const points = countByTopic(grammarPointTopicIds);

  return topics
    .filter((t) => t.id !== excludeTopicId)
    .filter((t) => (words.get(t.id) ?? 0) > 0 || (points.get(t.id) ?? 0) > 0)
    .sort(
      (a, b) =>
        // Numeric collation so "Group 6" sorts before "Group 12", the way a
        // teacher reads their own group list.
        (groupNames.get(a.groupId) ?? "").localeCompare(
          groupNames.get(b.groupId) ?? "",
          undefined,
          {
            numeric: true,
          }
        ) || a.orderIndex - b.orderIndex
    )
    .map((t) => ({
      topicId: t.id,
      title: t.title,
      groupName: groupNames.get(t.groupId) ?? "Group",
      wordCount: words.get(t.id) ?? 0,
      pointCount: points.get(t.id) ?? 0,
    }));
}

/** Narrows the reuse list to the topics that actually have content of `kind`. */
export function sourcesForKind(sources: TopicSource[], kind: TopicContentKind): TopicSource[] {
  return sources.filter((s) => (kind === "vocabulary" ? s.wordCount > 0 : s.pointCount > 0));
}

/** One-line label for a source in the picker, e.g. `Food — Group 12 · 12 words`. */
export function describeSource(source: TopicSource, kind: TopicContentKind): string {
  const count = kind === "vocabulary" ? source.wordCount : source.pointCount;
  const noun =
    kind === "vocabulary" ? `word${count === 1 ? "" : "s"}` : `rule${count === 1 ? "" : "s"}`;
  return `${source.title} — ${source.groupName} · ${count} ${noun}`;
}
