import { SignOutButton } from "~/features/auth";
import { RoutePlaceholder } from "~/features/dev";

export default function ProfilePlaceholder() {
  return (
    <RoutePlaceholder
      role="Teacher"
      title="Profile"
      links={[
        { label: "Groups", href: "/teacher" },
        { label: "Map", href: "/teacher/map" },
      ]}
    >
      <SignOutButton />
    </RoutePlaceholder>
  );
}
