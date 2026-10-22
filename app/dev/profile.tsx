import { Redirect, useLocalSearchParams } from "expo-router";

import { ProfileScreen } from "~/features/profile";

/**
 * The profile with made-up data and no backend — saving a name or a level
 * fails here, which shows the error states. Artwork resolves against
 * `EXPO_PUBLIC_WEB_ORIGIN`. `?role=teacher` shows the teacher's variant.
 * Dev-only.
 */
export default function ProfilePreviewScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  if (!__DEV__) return <Redirect href="/" />;

  if (role === "teacher")
    return (
      <ProfileScreen
        username="ms_kate"
        email="kate@school.org"
        mascotImageUrl="/wardrobe/slay-base.webp"
        level="elementary"
        availableLevels={["beginner", "elementary"]}
        locale="en"
        roleLabel="Teacher"
        levelHint="Sets which level your city map shows."
        showLanguagePicker={false}
      />
    );

  return (
    <ProfileScreen
      username="sam_k"
      email="sam@example.com"
      mascotImageUrl="/wardrobe/hat-crown.webp"
      level="elementary"
      availableLevels={["beginner", "elementary"]}
      latestPlacement={{
        totalCorrect: 23,
        totalQuestions: 40,
        recommendedLevel: "elementary",
        levelScores: [],
        takenAt: "2026-10-20T10:00:00Z",
      }}
    />
  );
}
