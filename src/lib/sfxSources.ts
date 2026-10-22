/**
 * The bundled sound effects — upstream's Web Audio synthesis rendered to files
 * by `scripts/render-sfx.mjs` (`npm run sfx:render`). Kept apart from
 * `sfx.ts` so tests can stand them in: vitest can't load a sound file.
 */
export const SFX_SOURCES = {
  /** `playMissionStartSfx`: an accelerating drum roll landing on a gong. */
  missionStart: require("../../assets/sounds/mission-start.m4a"),
  /** `playMapTravelSfx`: a soft pitch-down whoosh as the mascot glides to a new stop. */
  mapTravel: require("../../assets/sounds/map-travel.m4a"),
  /** `playSnakeHiss`: Slay's hiss, when the mascot is tapped. */
  snakeHiss: require("../../assets/sounds/snake-hiss.m4a"),
  /** `playRewardApplauseSfx`: a crowd roar, claps and firework pops. */
  rewardApplause: require("../../assets/sounds/reward-applause.m4a"),
};
