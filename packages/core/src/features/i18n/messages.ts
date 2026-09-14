import type { TaskFamily } from "@/features/parent/taskFamilies";
import type { UsernameProblem } from "@/features/profile/username";

/**
 * Every string the parent console shows — plus the student's own profile and
 * tab bar — in one shape.
 *
 * Counts and names arrive as function messages rather than templates with
 * placeholders, so each language can put the number where its grammar wants it
 * and pick its own plural form (see {@link file://./plural.ts}).
 *
 * Nothing authored by a teacher or an admin belongs here: district, location,
 * mission and homework titles stay in the language they were written in. Nor do
 * the knowledge-level names (`Beginner`, `Elementary`…), which are the ladder's
 * own terminology and read the same everywhere.
 */
export interface Messages {
  nav: {
    dashboard: string;
    map: string;
    profile: string;
  };

  common: {
    logOut: string;
    loading: string;
    loggingOut: string;
    /** Hours + minutes, e.g. "2 h 15 min" — units differ per language. */
    duration: (hours: number, minutes: number) => string;
    never: string;
  };

  dashboard: {
    title: string;
    progressOf: (studentName: string) => string;
    linking: (email: string) => string;
    noStudentLinked: string;
    yourStudent: string;

    pendingTitle: string;
    pendingNotRegistered: (who: string) => string;
    pendingNoProfile: (who: string) => string;
    pendingNotAStudent: (who: string) => string;
    pendingNoEmail: string;

    englishLevel: string;
    lastActive: string;
    lookLabel: string;
    xp: string;
    coins: string;

    vocabularyTitle: string;
    words: (count: number) => string;

    studyTimeTitle: string;
    studyTimeToday: string;
    studyTimeWeek: string;
    studyTimeTotal: string;
    studyTimeEmpty: string;
    studyTimeHint: string;
    weekdayInitials: readonly [string, string, string, string, string, string, string];

    missionsCompleted: string;
    tasksCompleted: string;
    currentStreak: string;
    longestStreak: string;
    days: (count: number) => string;

    mapProgressTitle: string;
    locationsUnlockedOf: (unlocked: number, total: number) => string;

    practiceTitle: string;
    practiceHint: string;
    practiceEmpty: string;
    families: Record<TaskFamily, string>;
    tasks: (count: number) => string;

    homeworkTitle: string;
    homeworkEmpty: string;
    homeworkHint: string;
    homeworkPassed: string;
    homeworkInProgress: string;
    homeworkNotStarted: string;
    homeworkVocabulary: string;
    homeworkGrammar: string;
    homeworkWords: (count: number) => string;
    homeworkRules: (count: number) => string;
    homeworkTeacher: (teacherName: string) => string;

    recentTitle: string;
    recentEmpty: string;
    recentScore: (score: number) => string;
  };

  profile: {
    title: string;
    roleLabel: string;
    signedIn: string;
    languageTitle: string;
    languageHint: string;
    languageAuto: string;
    languageAutoHint: (detected: string) => string;

    usernameTitle: string;
    usernameChange: string;
    usernameCancel: string;
    usernameSave: string;
    usernameSaving: string;
    usernameSaved: string;
    usernameHint: string;
    usernameErrors: Record<UsernameProblem, string>;

    studentTitle: string;
    studentLevelHint: string;
    studentNone: string;
  };

  /**
   * The student game's own chrome. Only the tab bar and the profile screen are
   * translated: everything a mission puts on screen is the English being
   * learned, and stays English on purpose.
   */
  student: {
    nav: {
      map: string;
      wardrobe: string;
      homework: string;
      profile: string;
    };

    profile: {
      title: string;
      /** Alt text for the player's snake at the top of the screen. */
      characterLabel: string;
      signedIn: string;

      languageTitle: string;
      languageHint: string;

      usernameTitle: string;
      usernameChange: string;
      usernameCancel: string;
      usernameSave: string;
      usernameSaving: string;
      usernameSaved: string;
      /** Explains what the name is for, under the field. */
      usernameHint: string;
      /** Why a chosen name was refused, keyed by {@link UsernameProblem}. */
      usernameErrors: Record<UsernameProblem, string>;

      levelTitle: string;
      levelChange: string;
      levelClose: string;
      levelSwitching: string;
      /** Shown when there is no other level with content to switch to. */
      levelOnlyOne: string;
      levelComingSoon: (levels: string) => string;

      logOut: string;
      loggingOut: string;
    };
  };

  /**
   * The signed-out demo: the map a visitor lands on before they have an
   * account, and the sign-up wall at the end of their one free location.
   *
   * This is the one part of the student game that follows the browser's
   * language rather than the fixed student default — a visitor has no profile
   * to have chosen a language on, and this is the screen that has to convince
   * them to make one. The missions themselves stay English, as everywhere.
   */
  demo: {
    /** Replaces the tab bar on the demo map — a visitor has no tabs to visit. */
    logIn: string;
    gateTitle: string;
    gateBody: string;
    gateBack: string;
  };

  map: {
    title: string;
    subtitle: string;
    nothingTitle: string;
    nothingBody: (levelName: string) => string;
    districtOf: (index: number, total: number) => string;
    previousDistrict: string;
    nextDistrict: string;
    completedBy: (who: string) => string;
    missionsProgress: (completed: number, total: number) => string;
    missionsCount: (count: number) => string;
    noLocations: string;
    loadingMap: string;
    selectedLocation: string;
    earnedHere: string;
    toEarnHere: string;
    /** Only the teacher console can open a location; kept so the shape is complete. */
    openMissions: string;
    openLocation: string;
    /** Repositioning a label — teacher console only, same completeness reason. */
    tapLocation: string;
    move: string;
    moveHint: (name: string) => string;
    moveCancel: string;
    moveFailed: string;
  };
}
