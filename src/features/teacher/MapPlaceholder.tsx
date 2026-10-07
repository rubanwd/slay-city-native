import { RoutePlaceholder } from "~/features/dev";

export default function MapPlaceholder() {
  return (
    <RoutePlaceholder
      role="Teacher"
      title="Map"
      links={[
        { label: "Groups", href: "/groups" },
        { label: "Profile", href: "/teacher-profile" },
      ]}
    />
  );
}
