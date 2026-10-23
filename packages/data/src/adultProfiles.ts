import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, KnowledgeLevel } from "@slay/core/types";
import { DEFAULT_KNOWLEDGE_LEVEL, isKnowledgeLevel, resolveMascotImage } from "@slay/core";

import { getAvailableLevels } from "./levels";
import { getLinkedStudent } from "./parent";

async function signedInUser(db: SupabaseClient<Database>) {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}

export interface TeacherProfileData {
  username: string | null;
  email: string | null;
  /** A teacher never plays, so the plain snake stands in as the avatar. */
  mascotImageUrl: string;
  /** Which level the teacher's city map previews. */
  level: KnowledgeLevel;
  availableLevels: KnowledgeLevel[];
}

/** Upstream's `src/app/teacher/profile/page.tsx`: the account, its level, and the levels with content. */
export async function loadTeacherProfile(db: SupabaseClient<Database>): Promise<TeacherProfileData> {
  const user = await signedInUser(db);
  const [profileRes, availableLevels] = await Promise.all([
    db.from("profiles").select("username, level").eq("id", user.id).maybeSingle(),
    getAvailableLevels(db),
  ]);
  if (profileRes.error) throw profileRes.error;
  return {
    username: profileRes.data?.username ?? null,
    email: user.email ?? null,
    mascotImageUrl: resolveMascotImage([]),
    level: isKnowledgeLevel(profileRes.data?.level) ? profileRes.data.level : DEFAULT_KNOWLEDGE_LEVEL,
    availableLevels,
  };
}

export interface ParentProfileData {
  username: string | null;
  email: string | null;
  /** The linked student's name and level — read-only; null while none is linked. */
  student: { username: string | null; level: KnowledgeLevel } | null;
}

/**
 * Upstream's `src/app/parent/profile/page.tsx`: the parent's account and the
 * student they follow. No look and no level of their own — the level is the
 * student's choice, shown read-only.
 */
export async function loadParentProfile(db: SupabaseClient<Database>): Promise<ParentProfileData> {
  const user = await signedInUser(db);
  const [profileRes, student] = await Promise.all([
    db.from("profiles").select("username").eq("id", user.id).maybeSingle(),
    getLinkedStudent(db, user.id),
  ]);
  if (profileRes.error) throw profileRes.error;
  return {
    username: profileRes.data?.username ?? null,
    email: user.email ?? null,
    student: student ? { username: student.username, level: student.level } : null,
  };
}
