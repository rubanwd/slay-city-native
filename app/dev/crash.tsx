import { Redirect } from "expo-router";

/** Throws on render, to see the root error boundary (WP-6.7). Dev-only. */
export default function CrashPreviewScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  throw new Error("A preview crash from /dev/crash");
}
