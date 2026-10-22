import { useLocalSearchParams } from "expo-router";

import { HomeworkTopicLoader } from "~/features/homework";

export default function HomeworkTopicRoute() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  return <HomeworkTopicLoader key={topicId} topicId={topicId} />;
}
