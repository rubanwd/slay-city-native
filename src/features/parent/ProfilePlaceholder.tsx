import { SignOutButton } from "~/features/auth";
import { RoutePlaceholder } from "~/features/dev";

export default function ProfilePlaceholder() {
  return (
    <RoutePlaceholder
      role="Parent"
      title="Profile"
      links={[
        { label: "Progress", href: "/parent" },
        { label: "Map", href: "/parent/map" },
      ]}
    >
      <SignOutButton />
    </RoutePlaceholder>
  );
}
