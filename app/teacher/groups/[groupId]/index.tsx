import { useLocalSearchParams } from "expo-router";

import { GroupTopicsLoader } from "~/features/teacher";

export default function GroupTopicsRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  return <GroupTopicsLoader key={groupId} groupId={groupId} />;
}
