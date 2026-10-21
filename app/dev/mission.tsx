import { Redirect } from "expo-router";

import { MissionScreen } from "~/features/mission";

/**
 * A three-task mission with made-up content, in review mode so nothing is
 * recorded — for trying `TaskRunner` on a device with no backend. The second
 * task is a type not ported yet, to show the skip card. Dev-only.
 */
export default function MissionPreviewScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <MissionScreen
      review
      exitHref="/dev/map"
      mission={{ id: "preview", title: "At the market", description: null, xpReward: 30, coinReward: 10 }}
      location={{ name: "Market", iconUrl: null }}
      tasks={[
        {
          id: "q1",
          taskType: "quiz",
          orderIndex: 0,
          content: { question: "Which one is a fruit?", options: ["Apple", "Chair", "Shoe"], correctIndex: 0 },
        },
        { id: "h1", taskType: "hangman", orderIndex: 1, content: { word: "BREAD" } },
        {
          id: "q2",
          taskType: "quiz",
          orderIndex: 2,
          content: { question: "How do you ask the price?", options: ["How much is it?", "Where is it?"], correctIndex: 0 },
        },
      ]}
    />
  );
}
