import { useLocalSearchParams } from "expo-router";

import { MissionLoader } from "~/features/mission";
import { StudyTimeTracker } from "~/features/study";

export default function MissionRoute() {
  const { missionId } = useLocalSearchParams<{ missionId: string }>();
  return (
    <>
      {/* Counts the time this mission stays open towards the student's study time. */}
      <StudyTimeTracker />
      <MissionLoader key={missionId} missionId={missionId} />
    </>
  );
}
