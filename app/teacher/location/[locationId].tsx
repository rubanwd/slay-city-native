import { useLocalSearchParams } from "expo-router";

import { ReviewLocationLoader } from "~/features/teacher";

export default function ReviewLocationRoute() {
  const { locationId } = useLocalSearchParams<{ locationId: string }>();
  return <ReviewLocationLoader key={locationId} locationId={locationId} />;
}
