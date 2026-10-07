import { Redirect } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { alpha, colors } from "@slay/tokens";

import { AppContainer } from "~/components/layout";
import { CoinIcon, ShareIcon, SlayButton, SlayCard, SlayInput, SlayText, XpIcon } from "~/components/ui";
import type { SlayButtonVariant } from "~/components/ui";

/**
 * Renders every component in every state from design/SCN-5/index.html, grouped
 * into the same sections as the design reference. Dev-only — never ships.
 */
export default function UiShowcaseScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <AppContainer>
      <ScrollView contentContainerStyle={{ paddingVertical: 24, gap: 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 4 }}>
          <SlayText variant="label" color={colors.neonPink}>
            design/SCN-5
          </SlayText>
          <SlayText variant="h1">UI components</SlayText>
          <SlayText variant="body" color={alpha.white60}>
            Every SlayText, SlayButton, SlayCard, SlayInput and AppContainer state, dev-only.
          </SlayText>
        </View>

        <TypeSection />
        <ButtonSection />
        <CardSection />
        <InputSection />
        <IconSection />
      </ScrollView>
    </AppContainer>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <SlayText variant="label" color={alpha.white50} style={{ marginBottom: 12 }}>
      {children}
    </SlayText>
  );
}

function TypeSection() {
  return (
    <View>
      <SectionHeading>SlayText</SectionHeading>
      <View style={{ gap: 14 }}>
        <SlayText variant="display">AMAZING!</SlayText>
        <SlayText variant="h1">Word Quest</SlayText>
        <SlayText variant="h2">City Map</SlayText>
        <SlayText variant="h3">Coffee Corner</SlayText>
        <SlayText variant="body">Match each word to its picture before the timer runs out.</SlayText>
        <SlayText variant="bodyStrong">apple · banana · cherry</SlayText>
        <SlayText variant="small">Owned · 150 coins</SlayText>
        <SlayText variant="label">Vocabulary learned</SlayText>
      </View>
    </View>
  );
}

const BUTTON_VARIANTS: SlayButtonVariant[] = ["pink", "green", "ghost"];

function ButtonSection() {
  return (
    <View>
      <SectionHeading>SlayButton — variants × states (md)</SectionHeading>
      <View style={{ gap: 16 }}>
        {BUTTON_VARIANTS.map((variant) => (
          <View key={variant} style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <SlayButton variant={variant}>Play</SlayButton>
            <SlayButton variant={variant} disabled>
              Play
            </SlayButton>
            <SlayButton variant={variant} loading>
              Play
            </SlayButton>
          </View>
        ))}
      </View>

      <SectionHeading>Sizes</SectionHeading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <SlayButton variant="green" size="sm">
          Start mission
        </SlayButton>
        <SlayButton variant="green" size="md">
          Start mission
        </SlayButton>
        <SlayButton variant="green" size="lg">
          Start mission
        </SlayButton>
      </View>
    </View>
  );
}

function CardSection() {
  return (
    <View>
      <SectionHeading>SlayCard — variants at rest</SectionHeading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {(["pink", "green", "cyan", "purple", "ghost"] as const).map((variant) => (
          <SlayCard key={variant} variant={variant} style={{ width: 150 }}>
            <SlayText variant="label" color={alpha.white50}>
              {variant}
            </SlayText>
            <SlayText variant="h3">Coffee Corner</SlayText>
            <SlayText variant="small" color={alpha.white50}>
              3 missions · 120 XP
            </SlayText>
          </SlayCard>
        ))}
      </View>

      <SectionHeading>Pressable — press on a device to see the glow</SectionHeading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {(["pink", "green", "ghost"] as const).map((variant) => (
          <SlayCard key={variant} variant={variant} pressable style={{ width: 150 }} onPress={() => {}}>
            <SlayText variant="h3">Coffee Corner</SlayText>
          </SlayCard>
        ))}
      </View>

      <SectionHeading>Anatomy — Header / Content / Footer, divided</SectionHeading>
      <SlayCard variant="cyan">
        <SlayCard.Header divided>
          <SlayText variant="bodyStrong">Header</SlayText>
          <SlayText variant="small" color={alpha.white50}>
            divided
          </SlayText>
        </SlayCard.Header>
        <SlayCard.Content>
          <SlayText variant="body" color={alpha.white60}>
            Content fills the rest: flex 1, minWidth 0.
          </SlayText>
        </SlayCard.Content>
        <SlayCard.Footer divided>
          <SlayText variant="small" color={alpha.white50}>
            Footer · divided
          </SlayText>
          <SlayButton variant="ghost" size="sm">
            Open
          </SlayButton>
        </SlayCard.Footer>
      </SlayCard>

      <View style={{ height: 14 }} />
      <SlayCard variant="purple" flush>
        <View style={{ height: 96, backgroundColor: colors.purple, borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
        <View style={{ padding: 16 }}>
          <SlayText variant="h3">flush</SlayText>
          <SlayText variant="small" color={alpha.white50}>
            no padding — for full-bleed media
          </SlayText>
        </View>
      </SlayCard>
    </View>
  );
}

function InputSection() {
  const [filled, setFilled] = useState("slay_master");
  const [errorValue, setErrorValue] = useState("sl");

  return (
    <View>
      <SectionHeading>SlayInput — every state</SectionHeading>
      <View style={{ gap: 20 }}>
        <SlayInput label="Username" placeholder="Your username" />
        <SlayInput
          label="Username"
          value={filled}
          onChangeText={setFilled}
          hint="2–20 letters, numbers, spaces or _"
        />
        <SlayInput label="Username (tap to focus)" placeholder="Your username" />
        <SlayInput label="Username" value="slay_master" editable={false} />
        <SlayInput
          label="Username"
          value={errorValue}
          onChangeText={setErrorValue}
          error="Username must be at least 2 characters."
        />
        <SlayInput label="Username" value="slay_master" success="Username saved." />
      </View>
    </View>
  );
}

const ICON_SIZES = [16, 24, 32, 48];

function IconSection() {
  return (
    <View>
      <SectionHeading>Icons — size × colour (WP-1.4)</SectionHeading>
      <View style={{ gap: 20 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          {ICON_SIZES.map((size) => (
            <CoinIcon key={size} size={size} />
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          {ICON_SIZES.map((size) => (
            <XpIcon key={size} size={size} />
          ))}
          <XpIcon size={32} color={colors.neonPink} />
          <XpIcon size={32} color={colors.white} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          {ICON_SIZES.map((size) => (
            <ShareIcon key={size} size={size} />
          ))}
          <ShareIcon size={32} color={colors.limeGreen} />
          <ShareIcon size={32} color={colors.neonPink} />
        </View>
      </View>
    </View>
  );
}
