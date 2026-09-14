import type { Json } from "@/types/database";

import type { MissionTaskType } from "./taskTypes";
import { getTaskImageSlots, isImageTaskContent } from "./taskImageSlots";

/**
 * Which image-capable task types *require* their image to play. picture_reveal
 * and word-to-image matching don't render without it (louder badge); the rest
 * treat artwork as an optional enhancement.
 */
const REQUIRED_IMAGE_TYPES: ReadonlySet<MissionTaskType> = new Set<MissionTaskType>([
  "picture_reveal",
  "matching",
]);

export interface TaskImageStatus {
  /** This task type + content carries artwork. */
  imageType: boolean;
  /** Total image slots (1 for single types, item count for lists). */
  total: number;
  /** Slots still without an image. */
  missing: number;
  /** True when the missing image(s) block the task from playing. */
  required: boolean;
}

const NOT_IMAGE: TaskImageStatus = { imageType: false, total: 0, missing: 0, required: false };

/**
 * Reports how many image slots a task has and how many are still empty, so the
 * admin list can flag tasks whose artwork is missing. Built on the shared
 * {@link getTaskImageSlots} so subject/slot logic lives in exactly one place.
 */
export function taskImageStatus(taskType: MissionTaskType, content: Json): TaskImageStatus {
  if (!isImageTaskContent(taskType, content)) return NOT_IMAGE;

  const slots = getTaskImageSlots(taskType, content).filter((s) => s.subject.trim());
  const missing = slots.filter((s) => !s.filled).length;
  return {
    imageType: true,
    total: slots.length,
    missing,
    required: REQUIRED_IMAGE_TYPES.has(taskType),
  };
}
