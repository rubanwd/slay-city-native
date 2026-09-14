import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/features/profile/username";

import type { Messages } from "../messages";
import { pluralSlavic } from "../plural";

/** Russian. */
export const ru: Messages = {
  nav: {
    dashboard: "Обзор",
    map: "Карта",
    profile: "Профиль",
  },

  common: {
    logOut: "Выйти",
    loading: "Загружаем кабинет…",
    loggingOut: "Выходим…",
    duration: (hours, minutes) => {
      if (hours === 0 && minutes === 0) return "0 мин";
      if (hours === 0) return `${minutes} мин`;
      if (minutes === 0) return `${hours} ч`;
      return `${hours} ч ${minutes} мин`;
    },
    never: "Никогда",
  },

  dashboard: {
    title: "Кабинет родителя",
    progressOf: (studentName) => `Прогресс: ${studentName}`,
    linking: (email) => `Подключаем ${email}`,
    noStudentLinked: "Ребёнок ещё не подключён",
    yourStudent: "ваш ребёнок",

    pendingTitle: "Прогресса пока нет",
    pendingNotRegistered: (who) =>
      `${who} ещё не присоединился к Slay City. Как только он зарегистрируется с этой почтой как ученик, прогресс появится здесь автоматически.`,
    pendingNoProfile: (who) =>
      `${who} зарегистрировался, но ещё не завершил настройку профиля. Прогресс появится сразу после этого.`,
    pendingNotAStudent: (who) =>
      `Аккаунт ${who} не является ученическим, поэтому учебного прогресса нет.`,
    pendingNoEmail: "К этому родительскому аккаунту ещё не подключён ни один ученик.",

    englishLevel: "Уровень английского",
    lastActive: "Последняя активность",
    lookLabel: "Сегодняшний образ",
    xp: "XP",
    coins: "Монеты",

    vocabularyTitle: "Выучено слов",
    words: (count) => pluralSlavic(count, "слово", "слова", "слов"),

    studyTimeTitle: "Время обучения",
    studyTimeToday: "Сегодня",
    studyTimeWeek: "Последние 7 дней",
    studyTimeTotal: "За всё время",
    studyTimeEmpty: "Время обучения ещё не записано.",
    studyTimeHint: "Считается только пока открыта миссия или домашнее задание.",
    weekdayInitials: ["П", "В", "С", "Ч", "П", "С", "В"],

    missionsCompleted: "Пройдено миссий",
    tasksCompleted: "Выполнено заданий",
    currentStreak: "Текущая серия",
    longestStreak: "Лучшая серия",
    days: (count) => pluralSlavic(count, "день", "дня", "дней"),

    mapProgressTitle: "Прогресс на карте города",
    locationsUnlockedOf: (unlocked, total) => `Открыто ${unlocked} из ${total} локаций`,

    practiceTitle: "Что ребёнок отрабатывает",
    practiceHint: "Задания внутри пройденных миссий.",
    practiceEmpty: "Пока ничего не отработано.",
    families: {
      words: "Слова и правописание",
      sentences: "Предложения и чтение",
      thinking: "Игры на мышление",
    },
    tasks: (count) => pluralSlavic(count, "задание", "задания", "заданий"),

    homeworkTitle: "Темы домашних заданий",
    homeworkEmpty: "Домашние задания ещё не заданы.",
    homeworkHint: "Темы, которые задаёт учитель.",
    homeworkPassed: "Сдано",
    homeworkInProgress: "В процессе",
    homeworkNotStarted: "Не начато",
    homeworkVocabulary: "Лексика",
    homeworkGrammar: "Грамматика",
    homeworkWords: (count) => `${count} ${pluralSlavic(count, "слово", "слова", "слов")}`,
    homeworkRules: (count) => `${count} ${pluralSlavic(count, "правило", "правила", "правил")}`,
    homeworkTeacher: (teacherName) => `Учитель: ${teacherName}`,

    recentTitle: "Последняя активность",
    recentEmpty: "Пока не пройдено ни одной миссии.",
    recentScore: (score) => `${score}%`,
  },

  profile: {
    title: "Профиль",
    roleLabel: "Родитель",
    signedIn: "Вы вошли",
    languageTitle: "Язык",
    languageHint: "Меняет язык вашего кабинета, карты и профиля.",
    languageAuto: "Автоматически",
    languageAutoHint: (detected) => `По языку браузера — сейчас ${detected}.`,

    usernameTitle: "Имя",
    usernameChange: "Изменить",
    usernameCancel: "Отмена",
    usernameSave: "Сохранить",
    usernameSaving: "Сохраняем…",
    usernameSaved: "Имя обновлено!",
    usernameHint: `До ${USERNAME_MAX_LENGTH} символов. Буквы, цифры, пробелы и _ - ' .`,
    usernameErrors: {
      too_short: `В имени должно быть минимум ${USERNAME_MIN_LENGTH} символа.`,
      too_long: `В имени может быть максимум ${USERNAME_MAX_LENGTH} символов.`,
      invalid_chars: "Можно использовать буквы, цифры, пробелы и _ - ' .",
      needs_letter: "Добавь хотя бы одну букву или цифру.",
      taken: "Такое имя уже занято. Попробуй другое.",
      unknown: "Не удалось сохранить имя. Попробуй ещё раз.",
    },

    studentTitle: "Ваш ребёнок",
    studentLevelHint: "Уровень, который изучает ребёнок — он выбирает его сам.",
    studentNone: "Ребёнок ещё не подключён.",
  },

  student: {
    nav: {
      map: "Карта",
      wardrobe: "Гардероб",
      homework: "Домашка",
      profile: "Профиль",
    },

    profile: {
      title: "Профиль",
      characterLabel: "Твой персонаж",
      signedIn: "Ты вошёл",

      languageTitle: "Язык",
      languageHint: "Меняет кнопки и меню. Миссии остаются на английском — это и есть урок.",

      usernameTitle: "Имя",
      usernameChange: "Изменить",
      usernameCancel: "Отмена",
      usernameSave: "Сохранить",
      usernameSaving: "Сохраняем…",
      usernameSaved: "Имя обновлено!",
      usernameHint: `До ${USERNAME_MAX_LENGTH} символов. Буквы, цифры, пробелы и _ - ' .`,
      usernameErrors: {
        too_short: `В имени должно быть минимум ${USERNAME_MIN_LENGTH} символа.`,
        too_long: `В имени может быть максимум ${USERNAME_MAX_LENGTH} символов.`,
        invalid_chars: "Можно использовать буквы, цифры, пробелы и _ - ' .",
        needs_letter: "Добавь хотя бы одну букву или цифру.",
        taken: "Такое имя уже занято. Попробуй другое.",
        unknown: "Не удалось сохранить имя. Попробуй ещё раз.",
      },

      levelTitle: "Уровень",
      levelChange: "Изменить",
      levelClose: "Закрыть",
      levelSwitching: "Меняем уровень…",
      levelOnlyOne: "Новые уровни откроются, когда в городе появятся новые районы.",
      levelComingSoon: (levels) => `Скоро: ${levels}.`,

      logOut: "Выйти",
      loggingOut: "Выходим…",
    },
  },

  demo: {
    logIn: "Войти",
    gateTitle: "Это было демо!",
    gateBody:
      "Чтобы исследовать город дальше, зарегистрируйся или войди. Тогда твои XP, монеты и прогресс сохранятся.",
    gateBack: "← Назад к карте",
  },

  map: {
    title: "Карта города",
    subtitle: "Что исследует ваш ребёнок",
    nothingTitle: "Пока нечего показать",
    nothingBody: (levelName) =>
      `Для уровня ${levelName} ещё не опубликован ни один район. Они появятся здесь, как только город разрастётся.`,
    districtOf: (index, total) => `Район ${index} из ${total}`,
    previousDistrict: "Предыдущий район",
    nextDistrict: "Следующий район",
    completedBy: (who) => `✓ пройдено: ${who}`,
    missionsProgress: (completed, total) => `${completed}/${total} миссий`,
    missionsCount: (count) => `${count} ${pluralSlavic(count, "миссия", "миссии", "миссий")}`,
    noLocations: "В этом районе ещё нет опубликованных локаций.",
    loadingMap: "Загружаем карту…",
    selectedLocation: "Выбранная локация",
    earnedHere: "заработано здесь",
    toEarnHere: "можно заработать здесь",
    openMissions: "▶ Открыть миссии",
    openLocation: "Открыть локацию",
    tapLocation: "Нажмите на локацию на карте, чтобы увидеть, что там есть.",
    move: "Переместить",
    moveHint: (name) => `Нажмите, где должна быть «${name}».`,
    moveCancel: "Отмена",
    moveFailed: "Не удалось переместить надпись. Попробуйте ещё раз.",
  },
};
