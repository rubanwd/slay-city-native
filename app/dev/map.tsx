import { Redirect } from "expo-router";
import { Alert } from "react-native";

import { DEFAULT_MASCOT_IMAGE, type MapLocationViewModel } from "@slay/core";

import { AppContainer } from "~/components/layout";
import { CityMap } from "~/features/map";

const stop = (id: string, name: string, mapX: number, mapY: number, done: number, total: number): MapLocationViewModel => ({
  id,
  name,
  description: null,
  mapX,
  mapY,
  iconUrl: null,
  state: done === total ? "completed" : "unlocked",
  missionId: done === total ? null : `${id}-m${done + 1}`,
  totalXp: total * 10,
  totalCoins: total * 5,
  missionsCompleted: done,
  totalMissions: total,
});

/**
 * The student map with made-up data and no backend — for checking layout,
 * the label float and the mascot's glide on a device before real content
 * exists. Dev-only, like the other `/dev` screens.
 */
export default function MapPreviewScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <AppContainer edges={["top", "bottom"]} flush>
      <CityMap
        district={{
          id: "preview",
          name: "Neon Downtown",
          backgroundUrl: null,
          locations: [
            stop("cafe", "Café", 24, 30, 3, 3),
            stop("library", "Library", 70, 26, 1, 4),
            stop("park", "City Park", 40, 55, 0, 3),
            stop("market", "Market", 76, 66, 0, 2),
          ],
        }}
        hud={{ xp: 340, coins: 125, level: 4, currentStreak: 3 }}
        mascotImageUrl={DEFAULT_MASCOT_IMAGE}
        showHomework={false}
        levelStatus={{ completed: false, levelName: "Starter", nextLevelName: "Elementary" }}
        onStartMission={(id) => Alert.alert("Start", id)}
        onRestartLocation={(_id, name) => Alert.alert("Restart", name)}
        onReplayLevel={(name) => Alert.alert("Replay", name)}
      />
    </AppContainer>
  );
}
