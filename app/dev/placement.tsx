import { Redirect } from "expo-router";

import type { PlacementQuestion } from "@slay/core";

import { PlacementTest } from "~/features/placement";

const QUESTIONS: PlacementQuestion[] = [
  { id: "11111111-1111-4111-8111-111111111111", level: "beginner", prompt: "I ___ a cat.", options: ["have", "has", "having", "haves"] },
  { id: "22222222-2222-4222-8222-222222222222", level: "elementary", prompt: "She ___ to school yesterday.", options: ["go", "went", "gone", "goes"] },
  { id: "33333333-3333-4333-8333-333333333333", level: "pre_intermediate", prompt: "If it rains, we ___ at home.", options: ["stay", "will stay", "stayed", "would stay"] },
];

/**
 * The level test with three made-up questions and a pretend grader, so every
 * screen — intro, questions, result — can be seen without a backend. Dev-only.
 */
export default function PlacementPreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <PlacementTest
      questions={QUESTIONS}
      currentLevel="beginner"
      availableLevels={["beginner", "elementary"]}
      mascotImageUrl="/wardrobe/hat-crown.webp"
      submit={async (answers) => ({
        ok: true,
        result: {
          totalCorrect: Object.keys(answers).length,
          totalQuestions: QUESTIONS.length,
          levelScores: [
            { level: "beginner", correct: 1, total: 1, passed: true },
            { level: "elementary", correct: 1, total: 1, passed: true },
            { level: "pre_intermediate", correct: 0, total: 1, passed: false },
          ],
          recommendedLevel: "pre_intermediate",
        },
      })}
    />
  );
}
