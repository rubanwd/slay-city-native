import { useIsFocused } from "expo-router";

import { recordStudyTime, STUDY_HEARTBEAT_SECONDS } from "@slay/data";

import { useAppStateAwareInterval } from "~/hooks/useAppStateAwareInterval";
import { supabase } from "~/lib/supabase";

/**
 * Port of upstream's `study/StudyTimeTracker.tsx`: an invisible heartbeat that
 * records how long a student spends on a learning screen — mounted on the
 * mission player and on homework topics, the only two places learning happens.
 *
 * It reports {@link STUDY_HEARTBEAT_SECONDS} each time that much has passed,
 * and only while the app is in the foreground *and* this screen is the one on
 * show. The web gets the second half for free — leaving a page unmounts it —
 * but a tab navigator keeps a visited screen mounted behind the others, so a
 * mission the student navigated away from must stop counting too. Returning
 * starts a fresh interval: no time away is ever counted, and nothing fires in
 * a burst.
 *
 * Each tick reports the interval that just elapsed rather than a running
 * total, so a dropped call loses that half-minute and nothing else. The value
 * is advisory — `record_study_time` clamps it, ignores anyone who is not a
 * student, and buckets it per day.
 */
export function StudyTimeTracker() {
  const focused = useIsFocused();

  useAppStateAwareInterval(
    () => {
      // A lost heartbeat must never surface mid-mission.
      recordStudyTime(supabase, STUDY_HEARTBEAT_SECONDS).catch(() => {});
    },
    focused ? STUDY_HEARTBEAT_SECONDS * 1000 : null,
  );

  return null;
}
