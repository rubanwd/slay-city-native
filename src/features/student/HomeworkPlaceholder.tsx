import { RoutePlaceholder } from "~/features/dev";

export default function HomeworkPlaceholder() {
  return (
    <RoutePlaceholder
      role="Student"
      title="Homework"
      links={[
        { label: "Map", href: "/map" },
        { label: "Wardrobe", href: "/wardrobe" },
        { label: "Profile", href: "/profile" },
      ]}
    />
  );
}
