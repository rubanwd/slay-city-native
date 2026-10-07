import { Redirect } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { alpha, colors } from "@slay/tokens";

import {
  AppContainer,
  Grid,
  ScrollScreen,
  Section,
  type GridCols,
  type GridGap,
  type SectionSpacing,
} from "~/components/layout";
import {
  CoinAmount,
  CoinIcon,
  ProgressBar,
  ShareIcon,
  SlayButton,
  SlayCard,
  SlayText,
  StreakBadge,
  XpAmount,
  XpIcon,
  type ProgressBarVariant,
  type SlayButtonSize,
  type SlayButtonVariant,
  type SlayCardVariant,
  type StreakBadgeSize,
} from "~/components/ui";

/**
 * Every WP-1.3 primitive in every variant and state, grouped the way
 * `.atlas/assets/slay-city-design-system-k57bb7.html` §3.1 and §5 group them.
 * This is the screen the side-by-side screenshot comparison against the web app
 * is taken from. Dev-only — it redirects in a release build and never ships a
 * route.
 *
 * Open it at `/dev/primitives`. `app/dev/ui.tsx` is its SCN-5 predecessor and
 * covers SlayText, SlayInput and the icons; this one covers what SCN-56 added.
 */
const BUTTON_VARIANTS: SlayButtonVariant[] = ["green", "pink", "ghost"];
const BUTTON_SIZES: SlayButtonSize[] = ["sm", "md", "lg"];
const CARD_VARIANTS: SlayCardVariant[] = ["pink", "green", "cyan", "purple", "ghost"];
const PROGRESS_VARIANTS: ProgressBarVariant[] = ["green", "pink", "cyan"];
const STREAK_SIZES: StreakBadgeSize[] = ["sm", "md", "lg"];
const SECTION_SPACINGS: SectionSpacing[] = ["none", "xs", "sm", "md", "lg", "xl"];
const GRID_COLS: GridCols[] = [1, 2, 3, 4];
const GRID_GAPS: GridGap[] = ["none", "xs", "sm", "md", "lg"];

export default function PrimitivesGalleryScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <AppContainer edges={["top"]}>
      <ScrollScreen footer={<GalleryFooter />}>
        <Section py="sm">
          <SlayText variant="label" color={colors.neonPink}>
            SCN-56 · WP-1.3
          </SlayText>
          <SlayText variant="h1">Primitives</SlayText>
          <SlayText variant="body" color={alpha.white60}>
            SlayButton, SlayCard, Section, Grid, AppContainer, ScrollScreen, ProgressBar,
            CurrencyAmount and StreakBadge, in every variant and state.
          </SlayText>
        </Section>

        <ButtonGallery />
        <CardGallery />
        <ProgressGallery />
        <CurrencyGallery />
        <StreakGallery />
        <SectionGallery />
        <GridGallery />
        <ContainerGallery />
      </ScrollScreen>
    </AppContainer>
  );
}

function Caption({ children }: { children: string }) {
  return (
    <SlayText variant="small" color={alpha.white50}>
      {children}
    </SlayText>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
      {children}
    </View>
  );
}

/** A visible frame, so a demo of spacing or a grid cell has an edge to measure. */
function Swatch({ children, label }: { children?: React.ReactNode; label?: string }) {
  return (
    <View
      style={{
        minHeight: 40,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: alpha.white15,
        backgroundColor: alpha.white5,
        borderRadius: 12,
        padding: 8,
      }}
    >
      {children ?? <Caption>{label ?? ""}</Caption>}
    </View>
  );
}

function ButtonGallery() {
  return (
    <Section title="SlayButton — variant × size">
      {BUTTON_SIZES.map((size) => (
        <View key={size} style={{ gap: 8 }}>
          <Caption>{size}</Caption>
          <Row>
            {BUTTON_VARIANTS.map((variant) => (
              <SlayButton key={variant} size={size} variant={variant}>
                Start
              </SlayButton>
            ))}
          </Row>
        </View>
      ))}

      <Caption>disabled · loading · iconLeft · iconRight</Caption>
      {BUTTON_VARIANTS.map((variant) => (
        <Row key={variant}>
          <SlayButton variant={variant} disabled>
            Start
          </SlayButton>
          <SlayButton variant={variant} loading>
            Saving
          </SlayButton>
          <SlayButton variant={variant} iconLeft={<ShareIcon size={16} color={colors.white} />}>
            Share
          </SlayButton>
          <SlayButton variant={variant} iconRight={<XpIcon size={16} color={colors.cyan} />}>
            Claim
          </SlayButton>
        </Row>
      ))}

      <Caption>full-width primary CTA (G4)</Caption>
      <SlayButton size="lg" variant="green" style={{ width: "100%" }}>
        Let&apos;s go!
      </SlayButton>
    </Section>
  );
}

function CardGallery() {
  return (
    <Section title="SlayCard — variant · pressable · flush · sections">
      <Grid cols={2} gap="md">
        {CARD_VARIANTS.map((variant) => (
          <SlayCard key={variant} variant={variant}>
            <SlayText variant="label" color={alpha.white50}>
              {variant}
            </SlayText>
            <SlayText variant="h3">Card</SlayText>
          </SlayCard>
        ))}
      </Grid>

      <Caption>pressable (press and hold for the glow and 1.02 scale)</Caption>
      <Grid cols={2} gap="md">
        {CARD_VARIANTS.map((variant) => (
          <SlayCard key={variant} variant={variant} pressable onPress={() => {}}>
            <SlayText variant="label" color={alpha.white50}>
              {variant}
            </SlayText>
            <SlayText variant="h3">Press</SlayText>
          </SlayCard>
        ))}
      </Grid>

      <Caption>Header / Content / Footer, divided</Caption>
      <SlayCard variant="cyan">
        <SlayCard.Header divided>
          <SlayText variant="h3">Coffee Corner</SlayText>
          <CoinAmount value={150} />
        </SlayCard.Header>
        <SlayCard.Content>
          <SlayText variant="body" color={alpha.white60}>
            Match each word to its picture before the timer runs out.
          </SlayText>
        </SlayCard.Content>
        <SlayCard.Footer divided>
          <SlayText variant="small" color={alpha.white50}>
            3 of 5 missions
          </SlayText>
          <XpAmount value={340} />
        </SlayCard.Footer>
      </SlayCard>

      <Caption>flush (no padding, for full-bleed media)</Caption>
      <SlayCard variant="purple" flush>
        <View style={{ height: 72, alignItems: "center", justifyContent: "center" }}>
          <SlayText variant="label" color={alpha.white50}>
            flush
          </SlayText>
        </View>
      </SlayCard>
    </Section>
  );
}

function ProgressGallery() {
  return (
    <Section title="ProgressBar — variant · height · labels">
      {PROGRESS_VARIANTS.map((variant, index) => (
        <ProgressBar key={variant} variant={variant} value={[60, 85, 30][index]} />
      ))}

      <Caption>labels: label + labelRight</Caption>
      <ProgressBar variant="pink" value={60} label="Progress" labelRight="3/5" />
      <ProgressBar variant="cyan" value={45} label="Level 3" labelRight="450 / 1000 XP" />

      <Caption>height 8 (score lists) · 10 (default) · 12 (parent map)</Caption>
      <ProgressBar value={85} height={8} />
      <ProgressBar value={85} height={10} />
      <ProgressBar value={85} height={12} />

      <Caption>edges: 0 (no glow) · 100 · animate off</Caption>
      <ProgressBar value={0} />
      <ProgressBar value={100} />
      <ProgressBar value={50} animate={false} />
    </Section>
  );
}

function CurrencyGallery() {
  return (
    <Section title="CoinAmount · XpAmount">
      <Caption>bodyStrong (default) · h3 · h2 · display · small</Caption>
      <Row>
        <CoinAmount value={120} />
        <CoinAmount value={120} variant="h3" />
        <CoinAmount value={120} variant="h2" />
        <CoinAmount value={120} variant="display" />
        <CoinAmount value={120} variant="small" />
      </Row>
      <Row>
        <XpAmount value={340} />
        <XpAmount value={340} variant="h3" />
        <XpAmount value={340} variant="h2" />
        <XpAmount value={340} variant="display" />
        <XpAmount value={340} variant="small" />
      </Row>

      <Caption>signed rewards · accessible labels · colour override</Caption>
      <Row>
        <CoinAmount value="+30" label="30 coins earned" />
        <XpAmount value="+120" label="120 XP earned" />
        <CoinAmount value={0} color={alpha.white40} />
      </Row>

      <Caption>the icons on their own, at 16 · 24 · 32</Caption>
      <Row>
        <CoinIcon size={16} />
        <CoinIcon size={24} />
        <CoinIcon size={32} />
        <XpIcon size={16} />
        <XpIcon size={24} />
        <XpIcon size={32} />
      </Row>
    </Section>
  );
}

function StreakGallery() {
  const [count, setCount] = useState(7);

  return (
    <Section title="StreakBadge — size · count-up · tooltip">
      <Caption>sm 28 · md 40 · lg 56 — tap one for its tooltip</Caption>
      <Row>
        {STREAK_SIZES.map((size) => (
          <StreakBadge key={size} count={count} size={size} />
        ))}
      </Row>

      <Row>
        <SlayButton size="sm" variant="ghost" onPress={() => setCount((n) => n + 1)}>
          +1 day
        </SlayButton>
        <SlayButton size="sm" variant="ghost" onPress={() => setCount(7)}>
          Reset
        </SlayButton>
      </Row>

      <Caption>custom tooltip copy</Caption>
      <StreakBadge count={30} tooltip="A whole month. Do not break it now." />
    </Section>
  );
}

function SectionGallery() {
  return (
    <Section title="Section — py scale · title">
      <Caption>each frame is one Section; the gap above and below is its py</Caption>
      <View style={{ borderWidth: 1, borderColor: alpha.white10, borderRadius: 12 }}>
        {SECTION_SPACINGS.map((py) => (
          <Section key={py} py={py} style={{ paddingHorizontal: 12 }}>
            <Swatch label={`py="${py}"`} />
          </Section>
        ))}
      </View>

      <Caption>pt and pb override py independently</Caption>
      <View style={{ borderWidth: 1, borderColor: alpha.white10, borderRadius: 12 }}>
        <Section py="xl" pt="none" pb="sm" style={{ paddingHorizontal: 12 }}>
          <Swatch label={'py="xl" pt="none" pb="sm"'} />
        </Section>
      </View>
    </Section>
  );
}

function GridGallery() {
  return (
    <Section title="Grid — cols 1–4 · gap scale">
      {GRID_COLS.map((cols) => (
        <View key={cols} style={{ gap: 8 }}>
          <Caption>{`cols=${cols}`}</Caption>
          <Grid cols={cols}>
            {Array.from({ length: cols * 2 }, (_, index) => (
              <Swatch key={index} label={String(index + 1)} />
            ))}
          </Grid>
        </View>
      ))}

      {GRID_GAPS.map((gap) => (
        <View key={gap} style={{ gap: 8 }}>
          <Caption>{`gap="${gap}"`}</Caption>
          <Grid cols={3} gap={gap}>
            {Array.from({ length: 3 }, (_, index) => (
              <Swatch key={index} label={String(index + 1)} />
            ))}
          </Grid>
        </View>
      ))}
    </Section>
  );
}

function ContainerGallery() {
  return (
    <Section title="AppContainer · ScrollScreen">
      <SlayText variant="body" color={alpha.white60}>
        This screen is the demo: an AppContainer with `edges={"{['top']}"}` — the footer below owns
        the bottom inset — wrapping a ScrollScreen whose `footer` is pinned under the scroll area.
      </SlayText>
      <Caption>
        flush, fixedHeight and the gutter are all on the container; scroll to the end to see the
        pinned footer stay put.
      </Caption>
      <Swatch>
        <SlayText variant="small" color={alpha.white50}>
          AppContainer gutter = 20pt either side of this frame
        </SlayText>
      </Swatch>
    </Section>
  );
}

function GalleryFooter() {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: alpha.white10,
        backgroundColor: colors.black,
        paddingVertical: 12,
        alignItems: "center",
      }}
    >
      <SlayText variant="label" color={alpha.white50}>
        ScrollScreen footer
      </SlayText>
    </View>
  );
}
