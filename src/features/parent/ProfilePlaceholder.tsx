import { RoutePlaceholder } from "~/features/dev";

export default function ProfilePlaceholder() {
  return (
    <RoutePlaceholder
      role="Parent"
      title="Profile"
      links={[
        { label: "Progress", href: "/progress" },
        { label: "Map", href: "/parent-map" },
      ]}
    />
  );
}
