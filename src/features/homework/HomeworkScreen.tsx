import { useRouter } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

import type { HomeworkTopicSummary } from "@slay/data";
import { alpha, colors, radii } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayPressable, SlayText } from "~/components/ui";

import { UnreadBadge } from "./UnreadBadge";

export interface HomeworkScreenProps {
  /** Names of every group the student belongs to — almost always just one, shown once up top. */
  groupNames: string[];
  topics: HomeworkTopicSummary[];
  refreshing?: boolean;
  onRefresh?: () => void;
}

function TopicCard({ topic }: { topic: HomeworkTopicSummary }) {
  const router = useRouter();
  const done = topic.totalModules > 0 && topic.passedModules >= topic.totalModules;
  const empty = topic.totalModules === 0;
  const status = empty ? "Nothing to study yet" : done ? "Completed" : `${topic.passedModules}/${topic.totalModules} passed`;
  const action = done ? "Review" : topic.passedModules > 0 ? "Continue" : "Start";

  return (
    <SlayPressable
      accessibilityRole="button"
      accessibilityLabel={`${topic.title}, by ${topic.teacherUsername}. ${status}${
        topic.unreadCount > 0 ? `. ${topic.unreadCount} unread` : ""
      }`}
      onPress={() => router.push({ pathname: "/homework/[topicId]", params: { topicId: topic.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <SlayText variant="label" weight="700" color={alpha.white40}>
        By {topic.teacherUsername}
      </SlayText>
      <View style={styles.titleRow}>
        <SlayText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
          {topic.title}
        </SlayText>
        <UnreadBadge count={topic.unreadCount} />
      </View>
      {topic.description ? (
        <SlayText variant="small" color={alpha.white50} numberOfLines={2}>
          {topic.description}
        </SlayText>
      ) : null}
      <View style={styles.footer}>
        <SlayText variant="label" weight="700" color={done ? colors.limeGreen : colors.cyan}>
          {status}
        </SlayText>
        {!empty ? (
          <View style={styles.chip}>
            <SlayText variant="label" weight="700">
              {action}
            </SlayText>
          </View>
        ) : null}
      </View>
    </SlayPressable>
  );
}

/**
 * Port of upstream's `HomeworkScreen.tsx`: every lesson topic across every
 * group the student belongs to, newest first. A virtualised list, so a long
 * homework history stays smooth; pull to refresh.
 */
export function HomeworkScreen({ groupNames, topics, refreshing = false, onRefresh }: HomeworkScreenProps) {
  return (
    <AppContainer edges={["top"]}>
      <FlatList
        data={topics}
        keyExtractor={(topic) => topic.id}
        renderItem={({ item }) => <TopicCard topic={item} />}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        contentContainerStyle={styles.list}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.limeGreen} /> : undefined
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <SlayText variant="h2" weight="900" accessibilityRole="header">
              Homework
            </SlayText>
            {groupNames.length > 0 ? (
              <SlayText variant="label" weight="700" color={colors.cyan}>
                {groupNames.join(" · ")}
              </SlayText>
            ) : null}
            <SlayText variant="small" color={alpha.white50}>
              Practice what your teacher assigned.
            </SlayText>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <SlayText variant="small" color={alpha.white60} style={styles.center}>
              No homework yet. Check back once your teacher assigns some.
            </SlayText>
          </View>
        }
      />
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  header: { gap: 4, paddingTop: 32, paddingBottom: 16 },
  gap: { height: 8 },
  center: { textAlign: "center" },
  card: {
    gap: 4,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cardPressed: { borderColor: alpha.white20 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  shrink: { flexShrink: 1 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8 },
  chip: { borderRadius: 999, backgroundColor: alpha.white10, paddingHorizontal: 12, paddingVertical: 4 },
  empty: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
});
