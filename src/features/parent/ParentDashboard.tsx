import { useMutation } from "@tanstack/react-query";
import { Image } from "expo-image";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path, Polyline } from "react-native-svg";

import { formatDate, formatDuration, getMessages, KNOWLEDGE_LEVEL_LABELS, percent, type HomeworkTopicProgress, type Locale } from "@slay/core";
import { signOut, type ParentDashboardData, type PendingReason, type PlacementAttemptSummary, type StudyTimeSummary } from "@slay/data";
import { alpha, artwork, colors, radii, withAlpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { CoinAmount, ProgressBar, SlayPressable, SlayText, XpAmount } from "~/components/ui";
import { imageSource } from "~/lib/imageSource";
import { supabase } from "~/lib/supabase";

export interface ParentDashboardProps {
  /** The language the whole console speaks. */
  locale: Locale;
  /** The registered student email — the fallback name, and who is being linked. */
  studentEmail: string | null;
  /** Everything known about the linked student; absent until one is linked. */
  data?: ParentDashboardData;
  /** Why no student is linked yet. */
  pendingReason?: PendingReason;
  refreshing?: boolean;
  onRefresh?: () => void;
}

type Strings = ReturnType<typeof getMessages>;

function pendingMessage(strings: Strings, studentEmail: string | null, reason: PendingReason): string {
  const messages = strings.dashboard;
  const who = studentEmail ? `"${studentEmail}"` : messages.yourStudent;
  switch (reason) {
    case "student_no_profile":
      return messages.pendingNoProfile(who);
    case "not_a_student":
      return messages.pendingNotAStudent(who);
    case "no_email":
      return messages.pendingNoEmail;
    default:
      return messages.pendingNotRegistered(who);
  }
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.heading}>
      <SlayText variant="label" color={alpha.white50} accessibilityRole="header">
        {title}
      </SlayText>
      {hint ? (
        <SlayText variant="small" color={alpha.white50}>
          {hint}
        </SlayText>
      ) : null}
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card style={styles.emptyCard}>
      <SlayText variant="small" color={alpha.white50} style={styles.center}>
        {text}
      </SlayText>
    </Card>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <Card style={styles.stat}>
      <SlayText variant="label" color={alpha.white50}>
        {label}
      </SlayText>
      <SlayText variant="display" weight="900" color={color}>
        {value}
      </SlayText>
    </Card>
  );
}

function LogOutPill({ label }: { label: string }) {
  const submit = useMutation({ mutationFn: () => signOut(supabase) });
  return (
    <SlayPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={submit.isPending}
      hitSlop={8}
      onPress={() => submit.mutate()}
      style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed, submit.isPending && styles.dim]}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={colors.neonPink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="16 17 21 12 16 7" stroke={colors.neonPink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Line x1={21} y1={12} x2={9} y2={12} stroke={colors.neonPink} strokeWidth={2} strokeLinecap="round" />
      </Svg>
      <SlayText variant="label" weight="600" color={colors.neonPink} style={styles.plain}>
        {label}
      </SlayText>
    </SlayPressable>
  );
}

/** The student today: the look they wear, their chosen level, and what the game has paid them. */
function StudentCard({ locale, strings, data, fallbackName }: { locale: Locale; strings: Strings; data: ParentDashboardData; fallbackName: string }) {
  const { student } = data;
  const look = imageSource(student.mascotImageUrl);
  return (
    <Card style={styles.studentCard}>
      <View style={styles.avatar}>{look ? <Image source={look} style={styles.fill} contentFit="contain" accessibilityLabel={strings.dashboard.lookLabel} /> : null}</View>
      <View style={styles.studentText}>
        <SlayText variant="h3" weight="900" numberOfLines={1}>
          {student.username ?? fallbackName}
        </SlayText>
        <SlayText variant="small" color={alpha.white50}>
          {strings.dashboard.englishLevel}:{" "}
          <SlayText variant="small" weight="700" color={alpha.white80}>
            {KNOWLEDGE_LEVEL_LABELS[student.level]}
          </SlayText>
        </SlayText>
        <View style={styles.rewards}>
          <XpAmount value={student.xp} label={`${student.xp} ${strings.dashboard.xp}`} variant="small" />
          <CoinAmount value={student.coins} label={`${student.coins} ${strings.dashboard.coins}`} variant="small" />
        </View>
        <SlayText variant="small" color={alpha.white50}>
          {strings.dashboard.lastActive}: {student.lastActivityDate ? formatDate(locale, student.lastActivityDate) : strings.common.never}
        </SlayText>
      </View>
    </Card>
  );
}

function PlacementSection({ locale, strings, placement }: { locale: Locale; strings: Strings; placement: PlacementAttemptSummary | null }) {
  const m = strings.dashboard;
  return (
    <View style={styles.section}>
      <SectionHeading title={m.placementTitle} hint={m.placementHint} />
      {!placement ? (
        <EmptyCard text={m.placementEmpty} />
      ) : (
        <View style={styles.placement}>
          <View style={styles.placementHead}>
            <View style={styles.shrink}>
              <SlayText variant="h2" weight="900" color={colors.cyan}>
                {KNOWLEDGE_LEVEL_LABELS[placement.recommendedLevel]}
              </SlayText>
              <SlayText variant="small" color={alpha.white60}>
                {m.placementScore(placement.totalCorrect, placement.totalQuestions)}
              </SlayText>
            </View>
            <SlayText variant="small" color={alpha.white50}>
              {m.placementTaken(formatDate(locale, placement.takenAt))}
            </SlayText>
          </View>
          {placement.levelScores.map((score) => (
            <ProgressBar
              key={score.level}
              value={percent(score.correct, score.total)}
              variant={score.passed ? "green" : "pink"}
              height={8}
              label={`${score.passed ? "✓ " : ""}${KNOWLEDGE_LEVEL_LABELS[score.level]}`}
              labelRight={`${score.correct}/${score.total}`}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** Time on task — recorded only while a mission or homework module is open, so it is time learning, not time signed in. */
function StudyTimeSection({ locale, strings, studyTime }: { locale: Locale; strings: Strings; studyTime: StudyTimeSummary }) {
  const m = strings.dashboard;
  const peak = Math.max(...studyTime.week.map((day) => day.seconds), 1);
  return (
    <View style={styles.section}>
      <SectionHeading title={m.studyTimeTitle} hint={m.studyTimeHint} />
      {studyTime.totalSeconds === 0 ? (
        <EmptyCard text={m.studyTimeEmpty} />
      ) : (
        <Card>
          <View style={styles.triple}>
            {[
              { label: m.studyTimeToday, seconds: studyTime.todaySeconds },
              { label: m.studyTimeWeek, seconds: studyTime.weekSeconds },
              { label: m.studyTimeTotal, seconds: studyTime.totalSeconds },
            ].map((entry) => (
              <View key={entry.label} style={styles.tripleCell}>
                <SlayText variant="label" color={alpha.white50}>
                  {entry.label}
                </SlayText>
                <SlayText variant="bodyStrong" weight="900" color={colors.cyan}>
                  {formatDuration(locale, entry.seconds)}
                </SlayText>
              </View>
            ))}
          </View>
          {/* Seven-day shape: relative bars, so a quiet day reads as quiet without an axis. */}
          <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {studyTime.week.map((day) => (
              <View key={day.day} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${Math.round((day.seconds / peak) * 100)}%` }]} />
                </View>
                <SlayText variant="label" color={alpha.white50} style={styles.barLabel}>
                  {m.weekdayInitials[(new Date(`${day.day}T00:00:00.000Z`).getUTCDay() + 6) % 7]}
                </SlayText>
              </View>
            ))}
          </View>
        </Card>
      )}
    </View>
  );
}

function PracticeSection({ strings, data }: { strings: Strings; data: ParentDashboardData }) {
  const m = strings.dashboard;
  const { taskFamilies, tasksCompleted } = data.progress;
  return (
    <View style={styles.section}>
      <SectionHeading title={m.practiceTitle} hint={m.practiceHint} />
      {taskFamilies.length === 0 ? (
        <EmptyCard text={m.practiceEmpty} />
      ) : (
        taskFamilies.map((entry) => {
          const share = tasksCompleted > 0 ? Math.round((entry.count / tasksCompleted) * 100) : 0;
          return (
            <Card key={entry.family} style={styles.row}>
              <View style={styles.rowHead}>
                <SlayText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
                  {m.families[entry.family]}
                </SlayText>
                <SlayText variant="small" weight="700" color={alpha.white60}>
                  {entry.count} {m.tasks(entry.count)}
                </SlayText>
              </View>
              <View style={styles.shareTrack}>
                <View style={[styles.shareFill, { width: `${share}%` }]} />
              </View>
            </Card>
          );
        })
      )}
    </View>
  );
}

function ModuleChip({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={[styles.chip, done ? styles.chipDone : styles.chipOpen]}>
      <SlayText variant="label" weight="700" color={done ? colors.limeGreen : alpha.white50} style={styles.plain}>
        {done ? "✓ " : ""}
        {label}
      </SlayText>
    </View>
  );
}

function HomeworkSection({ strings, topics }: { strings: Strings; topics: readonly HomeworkTopicProgress[] }) {
  const m = strings.dashboard;
  return (
    <View style={styles.section}>
      <SectionHeading title={m.homeworkTitle} hint={m.homeworkHint} />
      {topics.length === 0 ? (
        <EmptyCard text={m.homeworkEmpty} />
      ) : (
        topics.map((topic) => {
          const status = topic.passed ? m.homeworkPassed : topic.started ? m.homeworkInProgress : m.homeworkNotStarted;
          return (
            <Card key={topic.topicId} style={styles.row}>
              <View style={styles.rowHead}>
                <View style={styles.shrink}>
                  {/* Teacher-authored, shown exactly as written. */}
                  <SlayText variant="bodyStrong" numberOfLines={1}>
                    {topic.title}
                  </SlayText>
                  <SlayText variant="small" color={alpha.white50} numberOfLines={1}>
                    {topic.groupName}
                    {topic.teacherUsername ? ` · ${m.homeworkTeacher(topic.teacherUsername)}` : ""}
                  </SlayText>
                </View>
                <View style={[styles.chip, topic.passed ? styles.chipDone : topic.started ? styles.chipStarted : styles.chipOpen]}>
                  <SlayText variant="label" weight="700" color={topic.passed ? colors.limeGreen : topic.started ? artwork.status.inProgress : alpha.white50} style={styles.plain}>
                    {status}
                  </SlayText>
                </View>
              </View>
              <View style={styles.chips}>
                {topic.wordCount > 0 ? <ModuleChip label={`${m.homeworkVocabulary} · ${m.homeworkWords(topic.wordCount)}`} done={topic.vocabCompletedAt !== null} /> : null}
                {topic.grammarCount > 0 ? <ModuleChip label={`${m.homeworkGrammar} · ${m.homeworkRules(topic.grammarCount)}`} done={topic.grammarCompletedAt !== null} /> : null}
              </View>
            </Card>
          );
        })
      )}
    </View>
  );
}

/**
 * Port of upstream's `parent/ParentDashboard.tsx`: the linked student's
 * progress, read-only, in the parent's language — except authored content
 * (mission, district and homework titles), shown as written. Calmer than the
 * game screens, still on-brand. Until a student is linked, it says why.
 */
export function ParentDashboard({ locale, studentEmail, data, pendingReason = "student_not_registered", refreshing = false, onRefresh }: ParentDashboardProps) {
  const strings = getMessages(locale);
  const m = strings.dashboard;
  const subtitle = data ? m.progressOf(data.student.username ?? studentEmail ?? m.yourStudent) : studentEmail ? m.linking(studentEmail) : m.noStudentLinked;

  const header = (
    <View style={styles.header}>
      <View style={styles.shrink}>
        <SlayText variant="h2" weight="900" accessibilityRole="header">
          {m.title}
        </SlayText>
        <SlayText variant="small" color={alpha.white50} numberOfLines={1}>
          {subtitle}
        </SlayText>
      </View>
      <LogOutPill label={strings.common.logOut} />
    </View>
  );

  return (
    <AppContainer edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.limeGreen} /> : undefined}
      >
        {header}
        {!data ? (
          <Card style={styles.pending}>
            <View style={styles.pendingIcon}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={8} r={4} stroke={colors.neonPink} strokeWidth={2} />
                <Path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke={colors.neonPink} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </View>
            <SlayText variant="h3" weight="700">
              {m.pendingTitle}
            </SlayText>
            <SlayText variant="small" color={alpha.white60} style={styles.center}>
              {pendingMessage(strings, studentEmail, pendingReason)}
            </SlayText>
          </Card>
        ) : (
          <Linked locale={locale} strings={strings} data={data} fallbackName={studentEmail ?? m.yourStudent} />
        )}
      </ScrollView>
    </AppContainer>
  );
}

function Linked({ locale, strings, data, fallbackName }: { locale: Locale; strings: Strings; data: ParentDashboardData; fallbackName: string }) {
  const m = strings.dashboard;
  const { missionsCompleted, currentStreak, longestStreak, locationsUnlocked, totalLocations, vocabularyCount, tasksCompleted, recentActivity } = data.progress;
  const progressPct = totalLocations > 0 ? Math.round((locationsUnlocked / totalLocations) * 100) : 0;

  return (
    <>
      <StudentCard locale={locale} strings={strings} data={data} fallbackName={fallbackName} />

      <View style={styles.vocab} accessibilityLabel={`${m.vocabularyTitle}: ${vocabularyCount} ${m.words(vocabularyCount)}`}>
        <SlayText variant="label" color={alpha.white60}>
          {m.vocabularyTitle}
        </SlayText>
        <View style={styles.vocabLine}>
          <SlayText variant="display" weight="900" color={colors.neonPink}>
            {vocabularyCount}
          </SlayText>
          <SlayText variant="h3" weight="700" color={alpha.white80}>
            {m.words(vocabularyCount)}
          </SlayText>
        </View>
      </View>

      <PlacementSection locale={locale} strings={strings} placement={data.placement} />
      <StudyTimeSection locale={locale} strings={strings} studyTime={data.studyTime} />

      <View style={styles.grid}>
        <StatCard label={m.missionsCompleted} value={missionsCompleted} color={colors.limeGreen} />
        <StatCard label={m.tasksCompleted} value={tasksCompleted} color={colors.purple} />
        <StatCard label={m.currentStreak} value={`${currentStreak} ${m.days(currentStreak)}`} color={colors.neonPink} />
        <StatCard label={m.longestStreak} value={`${longestStreak} ${m.days(longestStreak)}`} color={colors.cyan} />
      </View>

      <View style={styles.section}>
        <View style={styles.rowHead}>
          <SlayText variant="label" color={alpha.white50} accessibilityRole="header">
            {m.mapProgressTitle}
          </SlayText>
          <SlayText variant="small" weight="700" color={alpha.white70}>
            {progressPct}%
          </SlayText>
        </View>
        <ProgressBar value={progressPct} variant="green" height={12} />
        <SlayText variant="small" color={alpha.white50}>
          {m.locationsUnlockedOf(locationsUnlocked, totalLocations)}
        </SlayText>
      </View>

      <PracticeSection strings={strings} data={data} />
      <HomeworkSection strings={strings} topics={data.homework} />

      <View style={styles.section}>
        <SectionHeading title={m.recentTitle} />
        {recentActivity.length === 0 ? (
          <EmptyCard text={m.recentEmpty} />
        ) : (
          recentActivity.map((item) => (
            <Card key={`${item.missionId}:${item.completedAt}`} style={styles.activity}>
              <View style={styles.activityLeft}>
                <View style={styles.tick}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M20 6L9 17l-5-5" stroke={colors.limeGreen} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                {/* Mission titles are authored content — never translated. */}
                <SlayText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
                  {item.title}
                </SlayText>
              </View>
              <View style={styles.activityRight}>
                {item.score !== null ? (
                  <SlayText variant="small" weight="700" color={colors.limeGreen}>
                    {m.recentScore(item.score)}
                  </SlayText>
                ) : null}
                <SlayText variant="small" color={alpha.white50}>
                  {formatDate(locale, item.completedAt)}
                </SlayText>
              </View>
            </Card>
          ))
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 20 },
  shrink: { flexShrink: 1, minWidth: 0 },
  center: { textAlign: "center" },
  plain: { textTransform: "none", letterSpacing: 0 },
  dim: { opacity: 0.5 },
  fill: { width: "100%", height: "100%" },
  logout: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: withAlpha(colors.neonPink, 0.4), paddingHorizontal: 14, paddingVertical: 8 },
  logoutPressed: { backgroundColor: withAlpha(colors.neonPink, 0.1) },
  card: { gap: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: alpha.white10, backgroundColor: colors.surface, padding: 16 },
  emptyCard: { paddingVertical: 24 },
  heading: { gap: 2, marginBottom: 4 },
  section: { gap: 8, marginTop: 20 },
  pending: { alignItems: "center", marginTop: 8, paddingVertical: 40 },
  pendingIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: withAlpha(colors.neonPink, 0.1) },
  studentCard: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: { width: 80, height: 80, overflow: "hidden", borderRadius: 999, borderWidth: 2, borderColor: colors.limeGreen, backgroundColor: alpha.white5, padding: 6 },
  studentText: { flexShrink: 1, minWidth: 0, gap: 4 },
  rewards: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  vocab: { gap: 4, marginTop: 16, borderRadius: radii.lg, borderWidth: 1, borderColor: withAlpha(colors.neonPink, 0.4), backgroundColor: withAlpha(colors.neonPink, 0.1), padding: 20 },
  vocabLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  placement: { gap: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: withAlpha(colors.cyan, 0.3), backgroundColor: withAlpha(colors.cyan, 0.05), padding: 16 },
  placementHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  triple: { flexDirection: "row", gap: 8 },
  tripleCell: { flex: 1, alignItems: "center", gap: 4 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barTrack: { width: "100%", height: 64, justifyContent: "flex-end", borderRadius: 6, backgroundColor: alpha.white5 },
  bar: { width: "100%", borderRadius: 6, backgroundColor: withAlpha(colors.cyan, 0.7) },
  barLabel: { fontSize: 10, textTransform: "none" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  stat: { flexBasis: "47%", flexGrow: 1, gap: 4 },
  row: { gap: 8 },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  shareTrack: { height: 6, overflow: "hidden", borderRadius: 999, backgroundColor: alpha.white10 },
  shareFill: { height: "100%", borderRadius: 999, backgroundColor: colors.purple },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipDone: { backgroundColor: withAlpha(colors.limeGreen, 0.15) },
  chipStarted: { backgroundColor: withAlpha(artwork.status.inProgress, 0.15) },
  chipOpen: { backgroundColor: alpha.white10 },
  activity: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12 },
  activityLeft: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1, minWidth: 0 },
  activityRight: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  tick: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: withAlpha(colors.limeGreen, 0.15) },
});
