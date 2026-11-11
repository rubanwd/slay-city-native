import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { RefreshControl, SectionList, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path, Polyline } from "react-native-svg";

import type { TeacherDashboardData, TeacherGroupStudent } from "@slay/data";
import { signOut } from "@slay/data";
import { alpha, colors, radii, withAlpha } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { SlayPressable, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

import { StudentCard } from "./StudentCard";

export interface TeacherDashboardProps extends TeacherDashboardData {
  refreshing?: boolean;
  onRefresh?: () => void;
}

interface DashboardRow {
  student: TeacherGroupStudent;
  groupId: string;
}

interface DashboardSection {
  key: string;
  title: string;
  individual: boolean;
  data: DashboardRow[];
}

const INDIVIDUAL_SECTION = "individual-students";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function LogOutPill() {
  const submit = useMutation({ mutationFn: () => signOut(supabase) });
  return (
    <SlayPressable
      accessibilityRole="button"
      accessibilityLabel="Log Out"
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
        Log Out
      </SlayText>
    </SlayPressable>
  );
}

/**
 * Port of upstream's `teacher/TeacherDashboard.tsx`: one section per group,
 * with a Homework link into its topics, and each student a compact expandable
 * row; 1-on-1 students come last, in their own "Individual students"
 * section, each with their own Homework link. No per-student activity list — a
 * class-sized group has to stay scannable. A virtualised `SectionList`, so a
 * large school's groups scroll smoothly; pull to refresh for the latest
 * progress.
 */
export function TeacherDashboard({ groups, username, email, refreshing = false, onRefresh }: TeacherDashboardProps) {
  const router = useRouter();
  const openGroup = (groupId: string) => router.push({ pathname: "/teacher/groups/[groupId]", params: { groupId } });
  const classGroups = groups.filter((group) => !group.isIndividual);
  // A 1-on-1 whose student's account was deleted has nobody left to show.
  const individuals = groups.filter((group) => group.isIndividual && group.students.length > 0);
  const summary = [
    classGroups.length > 0 && plural(classGroups.length, "group", "groups"),
    individuals.length > 0 && `${individuals.length} individual ${individuals.length === 1 ? "student" : "students"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const sections: DashboardSection[] = classGroups.map((group) => ({
    key: group.id,
    title: group.name,
    individual: false,
    data: group.students.map((student) => ({ student, groupId: group.id })),
  }));
  if (individuals.length > 0) {
    sections.push({
      key: INDIVIDUAL_SECTION,
      title: "Individual students",
      individual: true,
      data: individuals.map((group) => ({ student: group.students[0], groupId: group.id })),
    });
  }
  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <SlayText variant="h2" weight="900" accessibilityRole="header">
          Teacher Dashboard
        </SlayText>
        <SlayText variant="small" numberOfLines={1}>
          {username ?? email ?? "Teacher"}
        </SlayText>
        <SlayText variant="small" color={alpha.white50}>
          {summary || "No groups yet"}
        </SlayText>
      </View>
      <LogOutPill />
    </View>
  );

  return (
    <AppContainer edges={["top"]}>
      <SectionList
        sections={sections}
        keyExtractor={(row: DashboardRow, index) => `${row.groupId}:${row.student.id}:${index}`}
        renderItem={({ item, section }) => (
          <StudentCard student={item.student} onHomework={section.individual ? () => openGroup(item.groupId) : undefined} />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader} accessibilityRole="header">
            <SlayText variant="label" color={alpha.white50} numberOfLines={1} style={styles.shrink}>
              {section.title}
            </SlayText>
            <View style={styles.sectionRight}>
              <SlayText variant="small" weight="700" color={alpha.white50}>
                {plural(section.data.length, "student", "students")}
              </SlayText>
              {section.individual ? null : (
                <SlayPressable
                  accessibilityRole="link"
                  accessibilityLabel={`${section.title} homework`}
                  hitSlop={8}
                  onPress={() => openGroup(section.key)}
                  style={({ pressed }) => [styles.homework, pressed && styles.homeworkPressed]}
                >
                  <SlayText variant="label" weight="900" color={colors.limeGreen}>
                    Homework
                  </SlayText>
                </SlayPressable>
              )}
            </View>
          </View>
        )}
        renderSectionFooter={({ section }) => (
          <View style={styles.sectionGap}>
            {section.data.length === 0 ? (
              <View style={styles.emptyGroup}>
                <SlayText variant="small" color={alpha.white50} style={styles.center}>
                  No students in this group yet.
                </SlayText>
              </View>
            ) : null}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={colors.cyan} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx={9} cy={7} r={4} stroke={colors.cyan} strokeWidth={2} />
                <Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={colors.cyan} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <SlayText variant="h3" weight="700">
              No students assigned yet
            </SlayText>
            <SlayText variant="small" color={alpha.white60} style={styles.center}>
              An admin will assign your groups and individual students. They&apos;ll appear here once set up.
            </SlayText>
          </View>
        }
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.limeGreen} /> : undefined
        }
      />
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 20 },
  headerText: { flexShrink: 1, minWidth: 0 },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withAlpha(colors.neonPink, 0.4),
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logoutPressed: { backgroundColor: withAlpha(colors.neonPink, 0.1) },
  dim: { opacity: 0.5 },
  plain: { textTransform: "none", letterSpacing: 0 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  shrink: { flexShrink: 1 },
  sectionRight: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  homework: { borderRadius: 999, borderWidth: 1, borderColor: withAlpha(colors.limeGreen, 0.5), paddingHorizontal: 10, paddingVertical: 4 },
  homeworkPressed: { backgroundColor: withAlpha(colors.limeGreen, 0.1) },
  gap: { height: 8 },
  sectionGap: { marginBottom: 24 },
  center: { textAlign: "center" },
  emptyGroup: { borderRadius: radii.lg, borderWidth: 1, borderColor: alpha.white10, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 24 },
  empty: {
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha.white10,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: withAlpha(colors.cyan, 0.1) },
});
