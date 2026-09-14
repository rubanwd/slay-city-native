import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/features/profile/username";

import type { Messages } from "../messages";
import { pluralSlavic } from "../plural";

/** Ukrainian. */
export const uk: Messages = {
  nav: {
    dashboard: "Огляд",
    map: "Карта",
    profile: "Профіль",
  },

  common: {
    logOut: "Вийти",
    loading: "Завантажуємо кабінет…",
    loggingOut: "Виходимо…",
    duration: (hours, minutes) => {
      if (hours === 0 && minutes === 0) return "0 хв";
      if (hours === 0) return `${minutes} хв`;
      if (minutes === 0) return `${hours} год`;
      return `${hours} год ${minutes} хв`;
    },
    never: "Ніколи",
  },

  dashboard: {
    title: "Кабінет батьків",
    progressOf: (studentName) => `Прогрес: ${studentName}`,
    linking: (email) => `Підключаємо ${email}`,
    noStudentLinked: "Дитину ще не підключено",
    yourStudent: "ваша дитина",

    pendingTitle: "Прогресу ще немає",
    pendingNotRegistered: (who) =>
      `${who} ще не приєдналася до Slay City. Щойно вона зареєструється з цією поштою як учень, прогрес з’явиться тут автоматично.`,
    pendingNoProfile: (who) =>
      `${who} зареєструвалася, але ще не завершила налаштування профілю. Прогрес з’явиться одразу після цього.`,
    pendingNotAStudent: (who) =>
      `Акаунт ${who} не є учнівським, тому навчального прогресу немає.`,
    pendingNoEmail: "До цього батьківського акаунта ще не підключено жодного учня.",

    englishLevel: "Рівень англійської",
    lastActive: "Остання активність",
    lookLabel: "Сьогоднішній образ",
    xp: "XP",
    coins: "Монети",

    vocabularyTitle: "Вивчені слова",
    words: (count) => pluralSlavic(count, "слово", "слова", "слів"),

    studyTimeTitle: "Час навчання",
    studyTimeToday: "Сьогодні",
    studyTimeWeek: "Останні 7 днів",
    studyTimeTotal: "За весь час",
    studyTimeEmpty: "Часу навчання ще не зафіксовано.",
    studyTimeHint: "Рахується лише поки відкрита місія або домашнє завдання.",
    weekdayInitials: ["П", "В", "С", "Ч", "П", "С", "Н"],

    missionsCompleted: "Пройдено місій",
    tasksCompleted: "Виконано завдань",
    currentStreak: "Поточна серія",
    longestStreak: "Найдовша серія",
    days: (count) => pluralSlavic(count, "день", "дні", "днів"),

    mapProgressTitle: "Прогрес на карті міста",
    locationsUnlockedOf: (unlocked, total) => `Відкрито ${unlocked} із ${total} локацій`,

    practiceTitle: "Що дитина відпрацьовує",
    practiceHint: "Завдання всередині пройдених місій.",
    practiceEmpty: "Поки що нічого не відпрацьовано.",
    families: {
      words: "Слова й правопис",
      sentences: "Речення й читання",
      thinking: "Ігри на мислення",
    },
    tasks: (count) => pluralSlavic(count, "завдання", "завдання", "завдань"),

    homeworkTitle: "Теми домашніх завдань",
    homeworkEmpty: "Домашніх завдань ще не задано.",
    homeworkHint: "Теми, які задає вчитель.",
    homeworkPassed: "Складено",
    homeworkInProgress: "У процесі",
    homeworkNotStarted: "Не розпочато",
    homeworkVocabulary: "Лексика",
    homeworkGrammar: "Граматика",
    homeworkWords: (count) => `${count} ${pluralSlavic(count, "слово", "слова", "слів")}`,
    homeworkRules: (count) => `${count} ${pluralSlavic(count, "правило", "правила", "правил")}`,
    homeworkTeacher: (teacherName) => `Учитель: ${teacherName}`,

    recentTitle: "Остання активність",
    recentEmpty: "Жодної місії ще не пройдено.",
    recentScore: (score) => `${score}%`,
  },

  profile: {
    title: "Профіль",
    roleLabel: "Батьки",
    signedIn: "Ви увійшли",
    languageTitle: "Мова",
    languageHint: "Змінює мову вашого кабінету, карти та профілю.",
    languageAuto: "Автоматично",
    languageAutoHint: (detected) => `За мовою браузера — зараз ${detected}.`,

    usernameTitle: "Ім’я",
    usernameChange: "Змінити",
    usernameCancel: "Скасувати",
    usernameSave: "Зберегти",
    usernameSaving: "Зберігаємо…",
    usernameSaved: "Ім’я оновлено!",
    usernameHint: `До ${USERNAME_MAX_LENGTH} символів. Літери, цифри, пробіли та _ - ' .`,
    usernameErrors: {
      too_short: `В імені має бути щонайменше ${USERNAME_MIN_LENGTH} символи.`,
      too_long: `В імені може бути щонайбільше ${USERNAME_MAX_LENGTH} символів.`,
      invalid_chars: "Можна використати літери, цифри, пробіли та _ - ' .",
      needs_letter: "Додай хоча б одну літеру або цифру.",
      taken: "Таке ім’я вже зайняте. Спробуй інше.",
      unknown: "Не вдалося зберегти ім’я. Спробуй ще раз.",
    },

    studentTitle: "Ваша дитина",
    studentLevelHint: "Рівень, який вивчає дитина — вона обирає його сама.",
    studentNone: "Дитину ще не підключено.",
  },

  student: {
    nav: {
      map: "Карта",
      wardrobe: "Гардероб",
      homework: "Домашка",
      profile: "Профіль",
    },

    profile: {
      title: "Профіль",
      characterLabel: "Твій персонаж",
      signedIn: "Ти увійшов",

      languageTitle: "Мова",
      languageHint: "Змінює кнопки й меню. Місії лишаються англійською — це і є урок.",

      usernameTitle: "Ім’я",
      usernameChange: "Змінити",
      usernameCancel: "Скасувати",
      usernameSave: "Зберегти",
      usernameSaving: "Зберігаємо…",
      usernameSaved: "Ім’я оновлено!",
      usernameHint: `До ${USERNAME_MAX_LENGTH} символів. Літери, цифри, пробіли та _ - ' .`,
      usernameErrors: {
        too_short: `В імені має бути щонайменше ${USERNAME_MIN_LENGTH} символи.`,
        too_long: `В імені може бути щонайбільше ${USERNAME_MAX_LENGTH} символів.`,
        invalid_chars: "Можна використати літери, цифри, пробіли та _ - ' .",
        needs_letter: "Додай хоча б одну літеру або цифру.",
        taken: "Таке ім’я вже зайняте. Спробуй інше.",
        unknown: "Не вдалося зберегти ім’я. Спробуй ще раз.",
      },

      levelTitle: "Рівень",
      levelChange: "Змінити",
      levelClose: "Закрити",
      levelSwitching: "Змінюємо рівень…",
      levelOnlyOne: "Нові рівні відкриються, коли в місті з’являться нові райони.",
      levelComingSoon: (levels) => `Скоро: ${levels}.`,

      logOut: "Вийти",
      loggingOut: "Виходимо…",
    },
  },

  demo: {
    logIn: "Увійти",
    gateTitle: "Це було демо!",
    gateBody:
      "Щоб досліджувати місто далі, зареєструйся або увійди. Тоді твої XP, монети та прогрес збережуться.",
    gateBack: "← Назад до карти",
  },

  map: {
    title: "Карта міста",
    subtitle: "Що досліджує ваша дитина",
    nothingTitle: "Поки що нічого немає",
    nothingBody: (levelName) =>
      `Для рівня ${levelName} ще не опубліковано жодного району. Вони з’являться тут, щойно місто розростеться.`,
    districtOf: (index, total) => `Район ${index} з ${total}`,
    previousDistrict: "Попередній район",
    nextDistrict: "Наступний район",
    completedBy: (who) => `✓ пройдено: ${who}`,
    missionsProgress: (completed, total) => `${completed}/${total} місій`,
    missionsCount: (count) => `${count} ${pluralSlavic(count, "місія", "місії", "місій")}`,
    noLocations: "У цьому районі ще немає опублікованих локацій.",
    loadingMap: "Завантажуємо карту…",
    selectedLocation: "Вибрана локація",
    earnedHere: "зароблено тут",
    toEarnHere: "можна заробити тут",
    openMissions: "▶ Відкрити місії",
    openLocation: "Відкрити локацію",
    tapLocation: "Натисніть на локацію на карті, щоб побачити, що там є.",
    move: "Перемістити",
    moveHint: (name) => `Натисніть, де має бути «${name}».`,
    moveCancel: "Скасувати",
    moveFailed: "Не вдалося перемістити напис. Спробуйте ще раз.",
  },
};
