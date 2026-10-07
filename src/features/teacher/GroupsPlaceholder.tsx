import { RoutePlaceholder } from "~/features/dev";

export default function GroupsPlaceholder() {
  return (
    <RoutePlaceholder
      role="Teacher"
      title="Groups"
      links={[
        { label: "Map", href: "/teacher-map" },
        { label: "Profile", href: "/teacher-profile" },
      ]}
    />
  );
}
