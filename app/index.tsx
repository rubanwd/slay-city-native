import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Toolchain smoke screen.
 *
 * Deliberately plain. It exists to prove, on a physical device, that Expo Router
 * resolves, NativeWind compiles brand-token classes, the workspace alias to
 * `@slay/tokens` resolves through Metro, and safe-area insets apply — which is
 * exactly WP-0.1's acceptance criteria and nothing more.
 *
 * WP-1.5 replaces it with the real route skeleton.
 */
export default function Index() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center bg-black px-6"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <Text className="text-neon-pink font-sans text-display font-black">SLAY CITY</Text>
      <Text className="text-white/60 font-sans text-body mt-3 text-center">
        Native shell is up.
      </Text>
      <View className="mt-8 flex-row gap-2">
        <View className="bg-neon-pink h-3 w-12 rounded-full" />
        <View className="bg-lime-green h-3 w-12 rounded-full" />
        <View className="bg-cyan h-3 w-12 rounded-full" />
        <View className="bg-purple h-3 w-12 rounded-full" />
        <View className="bg-neon-orange h-3 w-12 rounded-full" />
      </View>
    </View>
  );
}
