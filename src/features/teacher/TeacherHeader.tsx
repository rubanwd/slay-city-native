import { useMutation } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Path, Polyline } from "react-native-svg";

import { signOut } from "@slay/data";
import { alpha, colors, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

export interface TeacherHeaderProps {
  title: string;
  /** When set, a back arrow leads here. */
  backHref?: Href;
}

/** Port of upstream's `teacher/TeacherHeader.tsx`: the header of every teacher screen past the dashboard. */
export function TeacherHeader({ title, backHref }: TeacherHeaderProps) {
  const router = useRouter();
  const leave = useMutation({ mutationFn: () => signOut(supabase) });

  return (
    <View style={styles.header}>
      {backHref ? (
        <SlayPressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={4} onPress={() => router.navigate(backHref)} style={styles.round}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={alpha.white70} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </SlayPressable>
      ) : null}
      <SlayText variant="h2" weight="900" numberOfLines={1} accessibilityRole="header" style={styles.title}>
        {title}
      </SlayText>
      <SlayPressable
        accessibilityRole="button"
        accessibilityLabel="Log out"
        disabled={leave.isPending}
        hitSlop={4}
        onPress={() => leave.mutate()}
        style={[styles.round, styles.logout]}
      >
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={colors.neonPink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Polyline points="16 17 21 12 16 7" stroke={colors.neonPink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={21} y1={12} x2={9} y2={12} stroke={colors.neonPink} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </SlayPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20 },
  title: { flex: 1, minWidth: 0 },
  round: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: alpha.white15 },
  logout: { borderColor: withAlpha(colors.neonPink, 0.4) },
});
