import { RoutePlaceholder } from "~/features/dev";

export default function WardrobePlaceholder() {
  return (
    <RoutePlaceholder
      role="Student"
      title="Wardrobe"
      links={[
        { label: "Map", href: "/map" },
        { label: "Homework", href: "/homework" },
        { label: "Profile", href: "/profile" },
      ]}
    />
  );
}
