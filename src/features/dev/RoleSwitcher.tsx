import { Link, type Href } from "expo-router";

import { alpha, colors } from "@slay/tokens";

import { AppContainer, ScrollScreen, Section } from "~/components/layout";
import { SlayText } from "~/components/ui";

interface RoleLink {
  role: string;
  label: string;
  href: Href;
}

const ROLE_LINKS: RoleLink[] = [
  { role: "Student", label: "Enter as Student → Map", href: "/map" },
  { role: "Teacher", label: "Enter as Teacher → Groups", href: "/groups" },
  { role: "Parent", label: "Enter as Parent → Progress", href: "/progress" },
];

/**
 * WP-1.5 dev-only route switcher. There is no session yet (WP-2.x) and no
 * role-based redirect (WP-2.6), so this is the only way to reach a role's
 * route tree on a device until then — it must not ship. Real auth replaces
 * this screen with the sign-in flow and a role-aware redirect out of `/`.
 */
export function RoleSwitcher() {
  return (
    <ScrollScreen>
      <AppContainer edges={["top"]}>
        <Section py="lg">
          <SlayText variant="label" color={colors.neonPink}>
            Dev only — removed at the auth milestone (WP-2.6)
          </SlayText>
          <SlayText variant="display">SLAY CITY</SlayText>
          <SlayText variant="body" color={alpha.white60}>
            Native shell is up. Jump into a role&apos;s route tree below to
            exercise navigation — none of these screens fetch data or decide
            real rewards yet.
          </SlayText>
        </Section>

        <Section title="Role groups" py="sm">
          {ROLE_LINKS.map((link) => (
            <Link key={link.role} href={link.href}>
              <SlayText variant="bodyStrong" color={colors.limeGreen}>
                {link.label}
              </SlayText>
            </Link>
          ))}
        </Section>
      </AppContainer>
    </ScrollScreen>
  );
}
