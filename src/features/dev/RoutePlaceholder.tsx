import { Link, type Href } from "expo-router";
import { type ReactNode } from "react";

import { alpha, colors } from "@slay/tokens";

import { AppContainer, ScrollScreen, Section } from "~/components/layout";
import { SlayText } from "~/components/ui";

export interface PlaceholderLink {
  label: string;
  href: Href;
}

export interface RoutePlaceholderProps {
  /** Which role group this screen belongs to — shown as a small eyebrow label. */
  role: "Student" | "Teacher" | "Parent";
  /** The screen's name, e.g. "Map", "Homework". */
  title: string;
  /** Every other placeholder in this role's tree, so navigation can be exercised. */
  links: PlaceholderLink[];
  /** Rendered under the links — e.g. the profile placeholders' Log Out button. */
  children?: ReactNode;
}

/**
 * WP-1.5 route skeleton — the body every placeholder screen renders. Not a
 * design-system primitive: it exists only so the full Expo Router tree for the
 * three roles can be walked on a device before any real screen is built.
 * Replaced route by route as each feature lands.
 */
export function RoutePlaceholder({ role, title, links, children }: RoutePlaceholderProps) {
  return (
    <ScrollScreen>
      <AppContainer edges={["top"]}>
        <Section py="lg">
          <SlayText variant="label" color={colors.neonPink}>
            {role} · placeholder
          </SlayText>
          <SlayText variant="display">{title}</SlayText>
          <SlayText variant="body" color={alpha.white60}>
            WP-1.5 route skeleton — no data, no business logic yet.
          </SlayText>
        </Section>

        <Section title="Other placeholders" py="sm">
          {links.map((link) => (
            <Link key={link.label} href={link.href}>
              <SlayText variant="bodyStrong" color={colors.limeGreen}>
                {link.label}
              </SlayText>
            </Link>
          ))}
        </Section>

        {children ? <Section py="sm">{children}</Section> : null}
      </AppContainer>
    </ScrollScreen>
  );
}
