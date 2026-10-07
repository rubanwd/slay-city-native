import { RoutePlaceholder } from "~/features/dev";

export default function ProgressPlaceholder() {
  return (
    <RoutePlaceholder
      role="Parent"
      title="Progress"
      links={[
        { label: "Map", href: "/parent-map" },
        { label: "Profile", href: "/parent-profile" },
      ]}
    />
  );
}
