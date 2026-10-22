import type { MissionTaskType, MissionTaskViewModel } from "@slay/core";
import type { Json } from "@slay/core/types";

/**
 * Made-up content for one task of each type the app plays, in the database's
 * own JSON shape — for `/dev/mission`, which runs them with no backend.
 * Add a row when a task type is ported.
 */
const CONTENT: [MissionTaskType, Json][] = [
  ["vocabulary", { word: "Apple", translation: "Яблуко", exampleSentence: "I eat an apple every day." }],
  ["quiz", { question: "Which one is a fruit?", options: ["Apple", "Chair", "Shoe"], correctIndex: 0 }],
  ["true_false", { statement: "Fish can swim.", isTrue: true }],
  ["analogy", { wordA: "Hot", wordB: "Cold", wordC: "Up", options: ["Down", "Left", "High", "Fast"], correctIndex: 0 }],
  ["antonym_match", { word: "Big", options: ["Huge", "Small", "Tall", "Wide"], correctIndex: 1 }],
  ["rhyme_match", { targetWord: "Cat", options: ["Hat", "Dog", "Cup", "Sun"], correctIndex: 0 }],
  ["odd_one_out", { words: ["Cat", "Dog", "Car", "Cow"], oddIndex: 2 }],
  ["cause_effect", { cause: "It starts to rain.", options: ["The ground gets wet.", "The sun gets hotter.", "Fish fly."], correctIndex: 0 }],
  [
    "dialogue_choice",
    { prompt: "Hi! How are you?", speaker: "Mia", options: ["I'm fine, thanks!", "Blue.", "At five."], correctIndex: 0, translation: "Привіт! Як справи?" },
  ],
  ["emoji_decode", { emojis: "☀️🌻", options: ["Sunflower", "Moonlight", "Rainbow"], correctIndex: 0 }],
  ["counting_game", { emoji: "🍎", count: 5, options: [3, 4, 5, 6] }],
  ["clock_reading", { hour: 3, minute: 30, options: ["3:30", "6:15", "12:00", "9:45"], correctIndex: 0 }],
  ["spot_the_difference", { emoji: "🐱", oddEmoji: "🐶", gridSize: 16, oddIndex: 9 }],
  ["matching", { prompt: "Match the words", pairs: [{ word: "Cat", match: "Кіт" }, { word: "Dog", match: "Пес" }, { word: "Bird", match: "Птах" }] }],
  ["sentence_builder", { words: ["I", "like", "green", "apples"], translation: "Я люблю зелені яблука" }],
  ["size_order", { items: ["Ant", "Cat", "Horse", "Whale"] }],
  ["word_scramble", { word: "APPLE", translation: "яблуко", hint: "A red or green fruit" }],
  ["letter_fill", { word: "BREAD", translation: "хліб" }],
  [
    "category_sort",
    {
      categories: ["Fruit", "Animals"],
      items: [
        { text: "Apple", categoryIndex: 0 },
        { text: "Cat", categoryIndex: 1 },
        { text: "Banana", categoryIndex: 0 },
        { text: "Dog", categoryIndex: 1 },
      ],
    },
  ],
  ["story_sequencing", { steps: [{ text: "Wake up" }, { text: "Brush your teeth" }, { text: "Eat breakfast" }, { text: "Go to school" }] }],
  // Not ported yet — shows the skip card.
  ["hangman", { word: "BREAD" }],
];

export const DEV_MISSION_TASKS: MissionTaskViewModel[] = CONTENT.map(([taskType, content], orderIndex) => ({
  id: `${taskType}-${orderIndex}`,
  taskType,
  orderIndex,
  content,
}));
