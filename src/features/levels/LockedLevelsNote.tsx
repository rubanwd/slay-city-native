import { DEFAULT_LOCALE, getMessages, KNOWLEDGE_LEVEL_LABELS, KNOWLEDGE_LEVELS, type Locale } from "@slay/core";
import type { KnowledgeLevel } from "@slay/core/types";
import { alpha } from "@slay/tokens";

import { SlayText } from "~/components/ui";

export interface LockedLevelsNoteProps {
  /** Levels that already have content — everything else is listed as locked. */
  available: readonly KnowledgeLevel[];
  /** Language for the "coming soon" line; the level names stay as authored. */
  locale?: Locale;
}

/**
 * Port of upstream's `levels/LockedLevelsNote.tsx`: the rest of the level
 * ladder as "coming soon", so a student sees where they're headed without
 * being offered a level that would open onto an empty map. Renders nothing
 * once every level has content.
 */
export function LockedLevelsNote({ available, locale = DEFAULT_LOCALE }: LockedLevelsNoteProps) {
  const locked = KNOWLEDGE_LEVELS.filter((level) => !available.includes(level));
  if (locked.length === 0) return null;

  return (
    <SlayText variant="small" color={alpha.white40}>
      {getMessages(locale).student.profile.levelComingSoon(locked.map((level) => KNOWLEDGE_LEVEL_LABELS[level]).join(", "))}
    </SlayText>
  );
}
