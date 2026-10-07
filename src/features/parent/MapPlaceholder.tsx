import { RoutePlaceholder } from "~/features/dev";

export default function MapPlaceholder() {
  return (
    <RoutePlaceholder
      role="Parent"
      title="Map"
      links={[
        { label: "Progress", href: "/progress" },
        { label: "Profile", href: "/parent-profile" },
      ]}
    />
  );
}
