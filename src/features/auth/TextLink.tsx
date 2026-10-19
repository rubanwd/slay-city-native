import { useRouter, type Href } from "expo-router";

import { colors } from "@slay/tokens";

import { SlayPressable, SlayText } from "~/components/ui";

/**
 * Upstream's inline `text-cyan font-semibold` link. The text is small, so the
 * hit slop carries the touch target up to 44pt.
 */
export function TextLink({ href, children }: { href: Href; children: string }) {
  const router = useRouter();

  return (
    <SlayPressable
      accessibilityRole="link"
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      onPress={() => router.push(href)}
    >
      <SlayText variant="small" weight="600" color={colors.cyan}>
        {children}
      </SlayText>
    </SlayPressable>
  );
}
