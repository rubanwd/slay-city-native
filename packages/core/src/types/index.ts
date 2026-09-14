import type { Database } from "./database";

export type { Database, Json } from "./database";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type UserRole = Enums["user_role"];
export type KnowledgeLevel = Enums["knowledge_level"];
export type MissionTaskType = Enums["mission_task_type"];
export type AiContentDraftStatus = Enums["ai_content_draft_status"];

export type Profile = Tables["profiles"]["Row"];
export type ProfileInsert = Tables["profiles"]["Insert"];
export type ProfileUpdate = Tables["profiles"]["Update"];

export type District = Tables["districts"]["Row"];
export type DistrictInsert = Tables["districts"]["Insert"];
export type DistrictUpdate = Tables["districts"]["Update"];

export type Location = Tables["locations"]["Row"];
export type LocationInsert = Tables["locations"]["Insert"];
export type LocationUpdate = Tables["locations"]["Update"];

export type Mission = Tables["missions"]["Row"];
export type MissionInsert = Tables["missions"]["Insert"];
export type MissionUpdate = Tables["missions"]["Update"];

export type VocabularyItem = Tables["vocabulary_items"]["Row"];
export type VocabularyItemInsert = Tables["vocabulary_items"]["Insert"];
export type VocabularyItemUpdate = Tables["vocabulary_items"]["Update"];

export type MissionTask = Tables["mission_tasks"]["Row"];
export type MissionTaskInsert = Tables["mission_tasks"]["Insert"];
export type MissionTaskUpdate = Tables["mission_tasks"]["Update"];

export type UserProgress = Tables["user_progress"]["Row"];
export type UserProgressInsert = Tables["user_progress"]["Insert"];
export type UserProgressUpdate = Tables["user_progress"]["Update"];

export type UserStats = Tables["user_stats"]["Row"];
export type UserStatsInsert = Tables["user_stats"]["Insert"];
export type UserStatsUpdate = Tables["user_stats"]["Update"];

export type WardrobeItem = Tables["wardrobe_items"]["Row"];
export type WardrobeItemInsert = Tables["wardrobe_items"]["Insert"];
export type WardrobeItemUpdate = Tables["wardrobe_items"]["Update"];

export type UserWardrobeItem = Tables["user_wardrobe_items"]["Row"];
export type UserWardrobeItemInsert = Tables["user_wardrobe_items"]["Insert"];
export type UserWardrobeItemUpdate = Tables["user_wardrobe_items"]["Update"];

export type Achievement = Tables["achievements"]["Row"];
export type AchievementInsert = Tables["achievements"]["Insert"];
export type AchievementUpdate = Tables["achievements"]["Update"];

export type UserAchievement = Tables["user_achievements"]["Row"];
export type UserAchievementInsert = Tables["user_achievements"]["Insert"];
export type UserAchievementUpdate = Tables["user_achievements"]["Update"];

export type FeedbackReport = Tables["feedback_reports"]["Row"];
export type FeedbackReportInsert = Tables["feedback_reports"]["Insert"];

export type AiContentDraft = Tables["ai_content_drafts"]["Row"];
export type AiContentDraftInsert = Tables["ai_content_drafts"]["Insert"];
export type AiContentDraftUpdate = Tables["ai_content_drafts"]["Update"];
