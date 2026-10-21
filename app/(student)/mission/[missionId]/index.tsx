import { useLocalSearchParams } from "expo-router";

import { MissionLoader } from "~/features/mission";

export default function MissionRoute() {
  const { missionId } = useLocalSearchParams<{ missionId: string }>();
  return <MissionLoader key={missionId} missionId={missionId} />;
}
