import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

import { DEFAULT_LOCALE, getMessages, KNOWLEDGE_LEVEL_LABELS, type Locale } from "@slay/core";
import type { KnowledgeLevel } from "@slay/core/types";
import { changeMyLevel } from "@slay/data";
import { alpha, colors } from "@slay/tokens";

import { SlayText } from "~/components/ui";
import { LevelPicker, LockedLevelsNote } from "~/features/levels";
import { MAP_QUERY_KEY } from "~/features/map";
import { supabase } from "~/lib/supabase";

import { cardStyle, ProfileCardHeader } from "./ProfileCardHeader";
import { PROFILE_QUERY_KEY } from "./queryKeys";

export interface ProfileLevelCardProps {
  /** The level the student is studying right now. */
  current: KnowledgeLevel;
  /** Levels with content — the only ones that can be switched to. */
  available: readonly KnowledgeLevel[];
  /** What this level controls for the viewer. */
  hint?: string;
  /** Language for the card's own words; level names are never translated. */
  locale?: Locale;
}

/**
 * Port of upstream's `profile/ProfileLevelCard.tsx`: a student changes their
 * knowledge level from their profile. Picking a level saves at once through
 * `set_my_knowledge_level`, which re-checks that the level has content, and
 * the map refetches around the new level's districts; progress is
 * per-mission, so switching never loses anything.
 *
 * Collapsed by default — the current level and a Change button.
 */
export function ProfileLevelCard({ current, available, hint, locale = DEFAULT_LOCALE }: ProfileLevelCardProps) {
  const messages = getMessages(locale).student.profile;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown while the server round-trips, so the tapped card reads as selected.
  const [optimistic, setOptimistic] = useState<KnowledgeLevel>(current);

  const change = useMutation({
    mutationFn: (level: KnowledgeLevel) => changeMyLevel(supabase, level),
    onSuccess: async (result) => {
      if (!result.ok) {
        setOptimistic(current);
        setError(result.error);
        return;
      }
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [MAP_QUERY_KEY] }),
        // A teacher's level picks which city their map previews.
        queryClient.invalidateQueries({ queryKey: ["teacher-map"] }),
      ]);
    },
    onError: (err) => {
      setOptimistic(current);
      setError(err.message);
    },
  });
  const pending = change.isPending;

  const canChange = available.length > 1 || (available.length === 1 && available[0] !== current);

  const pick = (level: KnowledgeLevel) => {
    if (level === optimistic) {
      setOpen(false);
      return;
    }
    setOptimistic(level);
    setError(null);
    change.mutate(level);
  };

  return (
    <View style={cardStyle}>
      <ProfileCardHeader
        title={messages.levelTitle}
        value={KNOWLEDGE_LEVEL_LABELS[optimistic]}
        valueColor={colors.limeGreen}
        toggle={
          canChange
            ? {
                label: open ? messages.levelClose : messages.levelChange,
                onPress: () => setOpen((value) => !value),
                disabled: pending,
                expanded: open,
              }
            : undefined
        }
      />

      {hint ? (
        <SlayText variant="small" color={alpha.white50}>
          {hint}
        </SlayText>
      ) : null}

      {open ? <LevelPicker levels={available} value={optimistic} onChange={pick} disabled={pending} /> : null}

      {!canChange ? (
        <SlayText variant="small" color={alpha.white50}>
          {messages.levelOnlyOne}
        </SlayText>
      ) : null}
      {open ? <LockedLevelsNote available={available} locale={locale} /> : null}

      {pending ? (
        <SlayText variant="small" color={alpha.white50} accessibilityLiveRegion="polite">
          {messages.levelSwitching}
        </SlayText>
      ) : null}
      {error ? (
        <SlayText variant="small" weight="600" color={colors.neonPink} accessibilityRole="alert">
          {error}
        </SlayText>
      ) : null}
    </View>
  );
}
