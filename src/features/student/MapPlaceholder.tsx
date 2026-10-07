import { RoutePlaceholder } from "~/features/dev";

export default function MapPlaceholder() {
  return (
    <RoutePlaceholder
      role="Student"
      title="Map"
      links={[
        { label: "Wardrobe", href: "/wardrobe" },
        { label: "Homework", href: "/homework" },
        { label: "Profile", href: "/profile" },
      ]}
    />
  );
}
