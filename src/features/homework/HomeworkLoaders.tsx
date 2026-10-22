import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { loadHomeworkList, loadHomeworkTopic } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayButton, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

import { HomeworkScreen } from "./HomeworkScreen";
import { HomeworkTopicScreen } from "./HomeworkTopicScreen";
import { HOMEWORK_QUERY_KEY } from "./queryKeys";

function Centered({ children }: { children: ReactNode }) {
  return (
    <AppContainer style={styles.center}>
      <View style={styles.message}>{children}</View>
    </AppContainer>
  );
}

function Failed({ text, onRetry, retrying }: { text: string; onRetry?: () => void; retrying?: boolean }) {
  const router = useRouter();
  return (
    <Centered>
      <SlayText variant="body" color={alpha.white60} style={styles.centerText}>
        {text}
      </SlayText>
      {onRetry ? (
        <SlayButton loading={retrying} onPress={onRetry}>
          Try again
        </SlayButton>
      ) : null}
      <SlayButton variant="ghost" onPress={() => router.navigate("/homework")}>
        Back to Homework
      </SlayButton>
    </Centered>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <AppContainer style={styles.center}>
      <ActivityIndicator size="large" color={colors.limeGreen} accessibilityLabel={label} />
    </AppContainer>
  );
}

/** `/homework`: loads the list (`loadHomeworkList`); pull to refresh. */
export function HomeworkListLoader() {
  const list = useQuery({ queryKey: [HOMEWORK_QUERY_KEY, "list"], queryFn: () => loadHomeworkList(supabase) });

  if (list.isPending) return <Loading label="Loading homework…" />;
  if (list.isError) {
    return (
      <Failed
        text="Could not load your homework. Check your connection and try again."
        onRetry={() => list.refetch()}
        retrying={list.isFetching}
      />
    );
  }
  return (
    <HomeworkScreen
      groupNames={list.data.groupNames}
      topics={list.data.topics}
      refreshing={list.isRefetching}
      onRefresh={() => list.refetch()}
    />
  );
}

/** `/homework/[topicId]`: loads one topic (`loadHomeworkTopic`). */
export function HomeworkTopicLoader({ topicId }: { topicId: string }) {
  const topic = useQuery({
    queryKey: [HOMEWORK_QUERY_KEY, "topic", topicId],
    queryFn: () => loadHomeworkTopic(supabase, topicId),
    // A topic keeps the cards and test it opened with; a refetch mid-flow
    // could reorder them under the student. The chat keeps itself fresh.
    staleTime: Infinity,
  });

  if (topic.isPending) return <Loading label="Loading topic…" />;
  if (topic.isError) {
    return (
      <Failed
        text="Could not load this topic. Check your connection and try again."
        onRetry={() => topic.refetch()}
        retrying={topic.isFetching}
      />
    );
  }
  if (!topic.data) return <Failed text="This topic isn't available." />;
  return <HomeworkTopicScreen {...topic.data} />;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  message: { width: "100%", gap: 16 },
  centerText: { textAlign: "center" },
});
