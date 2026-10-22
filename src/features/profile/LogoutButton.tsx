import { useMutation } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet } from "react-native";
import Svg, { Line, Path, Polyline } from "react-native-svg";

import { signOut } from "@slay/data";
import { colors, radii, withAlpha } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";
import { supabase } from "~/lib/supabase";

/**
 * The profile's pink-outlined Log Out, as upstream's `ProfileScreen` draws it.
 * Signing out clears the session; the route guard then takes the user to login.
 */
export function LogoutButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const submit = useMutation({ mutationFn: () => signOut(supabase) });
  const pending = submit.isPending;

  return (
    <SlayPressable
      accessibilityRole="button"
      accessibilityLabel={pending ? pendingLabel : label}
      aria-busy={pending}
      disabled={pending}
      onPress={() => submit.mutate()}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, pending && styles.disabled]}
    >
      {pending ? (
        <ActivityIndicator size="small" color={colors.neonPink} />
      ) : (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
            stroke={colors.neonPink}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline points="16 17 21 12 16 7" stroke={colors.neonPink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={21} y1={12} x2={9} y2={12} stroke={colors.neonPink} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      )}
      <SlayText variant="small" weight="600" color={colors.neonPink}>
        {pending ? pendingLabel : label}
      </SlayText>
    </SlayPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.neonPink, 0.4),
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pressed: { backgroundColor: withAlpha(colors.neonPink, 0.1) },
  disabled: { opacity: 0.5 },
});
