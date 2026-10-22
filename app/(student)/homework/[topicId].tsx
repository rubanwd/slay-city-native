import { useLocalSearchParams } from "expo-router";

import { HomeworkTopicLoader } from "~/features/homework";
import { StudyTimeTracker } from "~/features/study";

export default function HomeworkTopicRoute() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  return (
    <>
      {/* Homework counts towards study time exactly like a mission does. */}
      <StudyTimeTracker />
      <HomeworkTopicLoader key={topicId} topicId={topicId} />
    </>
  );
}
