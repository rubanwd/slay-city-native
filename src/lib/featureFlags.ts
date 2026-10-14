/**
 * Gates Sign in with Apple (WP-2.5, approved by OD-2 — docs/OD-2-DECISION.md).
 * Off by default so a build stays shippable before the Apple Developer Program
 * entitlement and `expo-apple-authentication` capability (WP-7.1) are both
 * live; flip `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true` once they are.
 */
export const APPLE_SIGN_IN_ENABLED = process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === "true";
