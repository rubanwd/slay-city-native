import { useLocalSearchParams } from "expo-router";

import { RoutePlaceholder } from "~/features/dev";

/** Where Start on the map goes. WP-3.2 replaces this with `MissionScreen`. */
export default function MissionRoute() {
  const { missionId } = useLocalSearchParams<{ missionId: string }>();

  return (
    <RoutePlaceholder role="Student" title={`Mission ${missionId ?? ""}`} links={[{ label: "Back to map", href: "/map" }]} />
  );
}
