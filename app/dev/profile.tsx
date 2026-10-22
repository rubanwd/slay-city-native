import { Redirect } from "expo-router";

import { ProfileScreen } from "~/features/profile";

/**
 * The profile with made-up data and no backend — saving a name or a level
 * fails here, which shows the error states. Artwork resolves against
 * `EXPO_PUBLIC_WEB_ORIGIN`. Dev-only.
 */
export default function ProfilePreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <ProfileScreen
      username="sam_k"
      email="sam@example.com"
      mascotImageUrl="/wardrobe/hat-crown.webp"
      level="elementary"
      availableLevels={["beginner", "elementary"]}
    />
  );
}
