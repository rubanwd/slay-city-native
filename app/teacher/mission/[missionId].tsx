import { useLocalSearchParams } from "expo-router";

import { ReviewMissionLoader } from "~/features/teacher";

export default function ReviewMissionRoute() {
  const { missionId } = useLocalSearchParams<{ missionId: string }>();
  return <ReviewMissionLoader key={missionId} missionId={missionId} />;
}
