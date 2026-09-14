import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/features/profile/username";

import type { Messages } from "../messages";
import { pluralEn } from "../plural";

/** English — also the fallback whenever a browser asks for a language we do not speak. */
export const en: Messages = {
  nav: {
    dashboard: "Dashboard",
    map: "Map",
    profile: "Profile",
  },

  common: {
    logOut: "Log Out",
    loading: "Loading dashboard…",
    loggingOut: "Logging out…",
    duration: (hours, minutes) => {
      if (hours === 0 && minutes === 0) return "0 min";
      if (hours === 0) return `${minutes} min`;
      if (minutes === 0) return `${hours} h`;
      return `${hours} h ${minutes} min`;
    },
    never: "Never",
  },

  dashboard: {
    title: "Parent Dashboard",
    progressOf: (studentName) => `${studentName}'s progress`,
    linking: (email) => `Linking ${email}`,
    noStudentLinked: "No student linked yet",
    yourStudent: "your student",

    pendingTitle: "No student progress yet",
    pendingNotRegistered: (who) =>
      `${who} hasn't joined Slay City yet. Once they sign up with this email as a Student, their progress will appear here automatically.`,
    pendingNoProfile: (who) =>
      `${who} has registered but hasn't finished setting up their profile yet. Their progress will appear here once they do.`,
    pendingNotAStudent: (who) =>
      `The account for ${who} isn't a Student account, so there's no learning progress to show.`,
    pendingNoEmail: "No student account is linked to this parent yet.",

    englishLevel: "English level",
    lastActive: "Last active",
    lookLabel: "Today's look",
    xp: "XP",
    coins: "Coins",

    vocabularyTitle: "Vocabulary Learned",
    words: (count) => pluralEn(count, "Word", "Words"),

    studyTimeTitle: "Time Spent Learning",
    studyTimeToday: "Today",
    studyTimeWeek: "Last 7 days",
    studyTimeTotal: "All time",
    studyTimeEmpty: "No learning time recorded yet.",
    studyTimeHint: "Counted only while a mission or homework module is open.",
    weekdayInitials: ["M", "T", "W", "T", "F", "S", "S"],

    missionsCompleted: "Missions Completed",
    tasksCompleted: "Tasks Completed",
    currentStreak: "Current Streak",
    longestStreak: "Longest Streak",
    days: (count) => pluralEn(count, "day", "days"),

    mapProgressTitle: "City Map Progress",
    locationsUnlockedOf: (unlocked, total) => `${unlocked} of ${total} locations unlocked`,

    practiceTitle: "What They Practise",
    practiceHint: "Tasks inside the missions they have finished.",
    practiceEmpty: "Nothing practised yet.",
    families: {
      words: "Words & spelling",
      sentences: "Sentences & reading",
      thinking: "Thinking games",
    },
    tasks: (count) => pluralEn(count, "task", "tasks"),

    homeworkTitle: "Homework Topics",
    homeworkEmpty: "No homework has been assigned yet.",
    homeworkHint: "Topics assigned by their teacher.",
    homeworkPassed: "Passed",
    homeworkInProgress: "In progress",
    homeworkNotStarted: "Not started",
    homeworkVocabulary: "Vocabulary",
    homeworkGrammar: "Grammar",
    homeworkWords: (count) => `${count} ${pluralEn(count, "word", "words")}`,
    homeworkRules: (count) => `${count} ${pluralEn(count, "rule", "rules")}`,
    homeworkTeacher: (teacherName) => `Teacher: ${teacherName}`,

    recentTitle: "Recent Activity",
    recentEmpty: "No missions completed yet.",
    recentScore: (score) => `${score}%`,
  },

  profile: {
    title: "Profile",
    roleLabel: "Parent",
    signedIn: "Signed in",
    languageTitle: "Language",
    languageHint: "Changes the language of your dashboard, map and profile.",
    languageAuto: "Automatic",
    languageAutoHint: (detected) => `Following your browser — currently ${detected}.`,

    usernameTitle: "Name",
    usernameChange: "Change",
    usernameCancel: "Cancel",
    usernameSave: "Save",
    usernameSaving: "Saving…",
    usernameSaved: "Name updated!",
    usernameHint: `Up to ${USERNAME_MAX_LENGTH} characters. Letters, numbers, spaces and _ - ' .`,
    usernameErrors: {
      too_short: `Your name needs at least ${USERNAME_MIN_LENGTH} characters.`,
      too_long: `Your name can be at most ${USERNAME_MAX_LENGTH} characters.`,
      invalid_chars: "You can use letters, numbers, spaces and _ - ' .",
      needs_letter: "Add at least one letter or number.",
      taken: "Someone already has that name. Try another one.",
      unknown: "Couldn't save that name. Try again.",
    },

    studentTitle: "Your student",
    studentLevelHint: "The level your student is studying — they choose it themselves.",
    studentNone: "No student linked yet.",
  },

  student: {
    nav: {
      map: "Map",
      wardrobe: "Wardrobe",
      homework: "Homework",
      profile: "Profile",
    },

    profile: {
      title: "Profile",
      characterLabel: "Your character",
      signedIn: "Signed in",

      languageTitle: "Language",
      languageHint: "Changes the buttons and menus. Missions stay in English — that's the lesson.",

      usernameTitle: "Name",
      usernameChange: "Change",
      usernameCancel: "Cancel",
      usernameSave: "Save",
      usernameSaving: "Saving…",
      usernameSaved: "Name updated!",
      usernameHint: `Up to ${USERNAME_MAX_LENGTH} characters. Letters, numbers, spaces and _ - ' .`,
      usernameErrors: {
        too_short: `Your name needs at least ${USERNAME_MIN_LENGTH} characters.`,
        too_long: `Your name can be at most ${USERNAME_MAX_LENGTH} characters.`,
        invalid_chars: "You can use letters, numbers, spaces and _ - ' .",
        needs_letter: "Add at least one letter or number.",
        taken: "Someone already has that name. Try another one.",
        unknown: "Couldn't save that name. Try again.",
      },

      levelTitle: "Level",
      levelChange: "Change",
      levelClose: "Close",
      levelSwitching: "Switching level…",
      levelOnlyOne: "More levels unlock as new districts are added to the city.",
      levelComingSoon: (levels) => `Coming soon: ${levels}.`,

      logOut: "Log Out",
      loggingOut: "Logging out…",
    },
  },

  demo: {
    logIn: "Log in",
    gateTitle: "That's the demo!",
    gateBody:
      "To keep exploring the city, create an account or log in. Then your XP, coins and progress are saved.",
    gateBack: "← Back to the map",
  },

  map: {
    title: "City Map",
    subtitle: "What your student explores",
    nothingTitle: "Nothing to show yet",
    nothingBody: (levelName) =>
      `No districts have been published for ${levelName} yet. They'll appear here as soon as the city grows.`,
    districtOf: (index, total) => `District ${index} of ${total}`,
    previousDistrict: "Previous district",
    nextDistrict: "Next district",
    completedBy: (who) => `✓ completed by ${who}`,
    missionsProgress: (completed, total) => `${completed}/${total} missions`,
    missionsCount: (count) => `${count} ${pluralEn(count, "mission", "missions")}`,
    noLocations: "This district has no published locations yet.",
    loadingMap: "Loading map…",
    selectedLocation: "Selected location",
    earnedHere: "earned here",
    toEarnHere: "to earn here",
    openMissions: "▶ Open missions",
    openLocation: "Open location",
    tapLocation: "Tap a location on the map to see what it holds.",
    move: "Move",
    moveHint: (name) => `Tap where “${name}” should sit.`,
    moveCancel: "Cancel",
    moveFailed: "Couldn't move that label. Please try again.",
  },
};
