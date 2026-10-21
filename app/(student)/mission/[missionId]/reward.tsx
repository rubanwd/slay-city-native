import { RoutePlaceholder } from "~/features/dev";

/** Where a finished mission lands. WP-3.7 replaces this with the reward screen. */
export default function RewardRoute() {
  return <RoutePlaceholder role="Student" title="Mission complete" links={[{ label: "Back to map", href: "/map" }]} />;
}
