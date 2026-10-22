import { useLocalSearchParams } from "expo-router";

import { TeacherTopicLoader } from "~/features/teacher";

export default function TeacherTopicRoute() {
  const { groupId, topicId } = useLocalSearchParams<{ groupId: string; topicId: string }>();
  return <TeacherTopicLoader key={topicId} groupId={groupId} topicId={topicId} />;
}
