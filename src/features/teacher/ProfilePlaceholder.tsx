import { RoutePlaceholder } from "~/features/dev";

export default function ProfilePlaceholder() {
  return (
    <RoutePlaceholder
      role="Teacher"
      title="Profile"
      links={[
        { label: "Groups", href: "/groups" },
        { label: "Map", href: "/teacher-map" },
      ]}
    />
  );
}
