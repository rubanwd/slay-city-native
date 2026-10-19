import { SignOutButton } from "~/features/auth";
import { RoutePlaceholder } from "~/features/dev";

export default function ProfilePlaceholder() {
  return (
    <RoutePlaceholder
      role="Student"
      title="Profile"
      links={[
        { label: "Map", href: "/map" },
        { label: "Wardrobe", href: "/wardrobe" },
        { label: "Homework", href: "/homework" },
      ]}
    >
      <SignOutButton />
    </RoutePlaceholder>
  );
}
