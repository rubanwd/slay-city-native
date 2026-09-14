import type { Json } from "@/types/database";

import type { MissionTaskType } from "./taskTypes";

/**
 * One image slot on a task's content: the subject to illustrate, whether it's
 * already filled, and how to write a URL back into the content object.
 *
 * `apply` mutates the passed content object in place, so a caller parses the
 * task's JSONB, fills slots, and writes the object straight back to the row.
 * Shared by the admin list badge, the per-mission bulk generator, and the
 * standalone backfill script (which reimplements the same shapes in JS).
 */
export interface TaskImageSlot {
  subject: string;
  filled: boolean;
  apply: (url: string) => void;
}

type Rec = { [key: string]: Json };

function isRecord(value: Json | null | undefined): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUrl(value: Json | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function str(value: Json | undefined): string {
  return typeof value === "string" ? value : "";
}

/**
 * True when a task of this type + content carries any image slots. Matching is
 * only an image task in word-to-image mode; every other listed type always is.
 */
export function isImageTaskContent(taskType: MissionTaskType, content: Json): boolean {
  const record = isRecord(content) ? content : {};
  switch (taskType) {
    case "vocabulary":
    case "quiz":
    case "true_false":
    case "word_scramble":
    case "picture_reveal":
    case "flashcards":
      return true;
    case "matching":
      return record.mode === "word-to-image";
    default:
      return false;
  }
}

/** Returns the image slots for a task, or `[]` when the type carries no images. */
export function getTaskImageSlots(taskType: MissionTaskType, content: Json): TaskImageSlot[] {
  if (!isRecord(content)) return [];
  const c = content;

  const single = (subject: string): TaskImageSlot[] => [
    { subject, filled: hasUrl(c.imageUrl ?? c.image_url), apply: (url) => (c.imageUrl = url) },
  ];

  switch (taskType) {
    case "vocabulary":
    case "word_scramble":
      return single(str(c.word));
    case "quiz":
    case "picture_reveal": {
      const options = Array.isArray(c.options) ? c.options : [];
      const opt = options[typeof c.correctIndex === "number" ? c.correctIndex : -1];
      const subject = (str(opt) || str(c.question)).trim();
      return single(subject);
    }
    case "true_false": {
      // Seed statements read: “Word” means “переклад”. — take the first quoted term.
      const m = /[“"']([^“”"']+)[”"']/.exec(str(c.statement));
      const subject = (m ? m[1] : str(c.statement).split(/\s+/)[0] ?? "").trim();
      return single(subject);
    }
    case "flashcards": {
      const cards = Array.isArray(c.cards) ? c.cards : [];
      const slots: TaskImageSlot[] = [];
      cards.forEach((card) => {
        if (!isRecord(card)) return;
        slots.push({
          subject: str(card.front),
          filled: hasUrl(card.imageUrl ?? card.image_url),
          apply: (url) => (card.imageUrl = url),
        });
      });
      return slots;
    }
    case "matching": {
      if (c.mode !== "word-to-image") return [];
      const pairs = Array.isArray(c.pairs) ? c.pairs : [];
      const slots: TaskImageSlot[] = [];
      pairs.forEach((pair) => {
        if (!isRecord(pair)) return;
        slots.push({
          subject: str(pair.word),
          filled: hasUrl(pair.match),
          apply: (url) => (pair.match = url),
        });
      });
      return slots;
    }
    default:
      return [];
  }
}

export interface ImageCounts {
  /** Slots that carry (or should carry) an image. */
  total: number;
  /** Slots still empty. */
  missing: number;
}

/** Totals across a set of tasks — used to summarise a whole mission. */
export function countImageSlots(
  tasks: { task_type: MissionTaskType; content: Json }[]
): ImageCounts {
  let total = 0;
  let missing = 0;
  for (const task of tasks) {
    for (const slot of getTaskImageSlots(task.task_type, task.content)) {
      if (!slot.subject.trim()) continue;
      total += 1;
      if (!slot.filled) missing += 1;
    }
  }
  return { total, missing };
}
