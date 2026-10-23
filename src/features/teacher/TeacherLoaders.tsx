import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";

import { sourcesForKind } from "@slay/core";
import { loadGroupTopics, loadTeacherTopic } from "@slay/data";
import { alpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { FullScreenLoader, SlayButton, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

import { GroupTopicsScreen } from "./GroupTopicsScreen";
import { TEACHER_GROUP_QUERY_KEY, TEACHER_TOPIC_QUERY_KEY } from "./queryKeys";
import { GrammarManager } from "./GrammarManager";
import { TeacherTopicScreen } from "./TeacherTopicScreen";
import { VocabularyManager } from "./VocabularyManager";

function Loading({ label }: { label: string }) {
  return (
    <AppContainer>
      <FullScreenLoader label={label} mascot={false} />
    </AppContainer>
  );
}

function Failed({ text, onRetry, retrying, back }: { text: string; onRetry: () => void; retrying: boolean; back: Href }) {
  const router = useRouter();
  return (
    <AppContainer style={styles.center}>
      <View style={styles.message}>
        <SlayText variant="body" color={alpha.white60} style={styles.centerText}>
          {text}
        </SlayText>
        <SlayButton loading={retrying} onPress={onRetry}>
          Try again
        </SlayButton>
        <SlayButton variant="ghost" onPress={() => router.navigate(back)}>
          Back
        </SlayButton>
      </View>
    </AppContainer>
  );
}

/** `/teacher/groups/[groupId]`. A group that isn't this teacher's sends them home, as upstream redirects. */
export function GroupTopicsLoader({ groupId }: { groupId: string }) {
  const group = useQuery({ queryKey: [TEACHER_GROUP_QUERY_KEY, groupId], queryFn: () => loadGroupTopics(supabase, groupId), refetchOnWindowFocus: true });
  if (group.isPending) return <Loading label="Loading topics…" />;
  if (group.isError) return <Failed text="Could not load this group's topics." onRetry={() => group.refetch()} retrying={group.isFetching} back="/teacher" />;
  if (!group.data) return <Redirect href="/teacher" />;
  return <GroupTopicsScreen {...group.data} refreshing={group.isRefetching} onRefresh={() => group.refetch()} />;
}

/**
 * `/teacher/groups/[groupId]/topics/[topicId]`, with the vocabulary and
 * grammar editors in their sections. A topic outside this teacher's group goes back to the group,
 * as upstream redirects.
 */
export function TeacherTopicLoader({ groupId, topicId }: { groupId: string; topicId: string }) {
  const topic = useQuery({
    queryKey: [TEACHER_TOPIC_QUERY_KEY, topicId],
    queryFn: () => loadTeacherTopic(supabase, groupId, topicId),
    refetchOnWindowFocus: true,
  });
  if (topic.isPending) return <Loading label="Loading topic…" />;
  if (topic.isError)
    return (
      <Failed
        text="Could not load this topic."
        onRetry={() => topic.refetch()}
        retrying={topic.isFetching}
        back={{ pathname: "/teacher/groups/[groupId]", params: { groupId } }}
      />
    );
  if (!topic.data) return <Redirect href={{ pathname: "/teacher/groups/[groupId]", params: { groupId } }} />;
  const data = topic.data;
  return (
    <TeacherTopicScreen
      {...data}
      vocabularyEditor={
        <VocabularyManager
          topicId={data.topic.id}
          groupId={data.group.id}
          initialWords={data.vocabWords}
          initialTaskCount={data.vocabTaskCount}
          reuseSources={sourcesForKind(data.reuseSources, "vocabulary")}
        />
      }
      grammarEditor={
        <GrammarManager
          topicId={data.topic.id}
          groupId={data.group.id}
          initialPoints={data.grammarPoints}
          initialTasks={data.grammarTasks}
          reuseSources={sourcesForKind(data.reuseSources, "grammar")}
        />
      }
      refreshing={topic.isRefetching}
      onRefresh={() => topic.refetch()}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  message: { width: "100%", gap: 16 },
  centerText: { textAlign: "center" },
});
