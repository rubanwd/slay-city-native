import { render, screen } from "@testing-library/react";
import { Text } from "react-native";
import { describe, expect, it } from "vitest";

import { SlayText } from "~/components/ui/SlayText";

import { AppContainer } from "./AppContainer";
import { Grid, type GridCols, type GridGap } from "./Grid";
import { ScrollScreen } from "./ScrollScreen";
import { Section, type SectionSpacing } from "./Section";

const COLS: GridCols[] = [1, 2, 3, 4];
const GAPS: GridGap[] = ["none", "xs", "sm", "md", "lg"];
const SPACINGS: SectionSpacing[] = ["none", "xs", "sm", "md", "lg", "xl"];

describe("AppContainer", () => {
  it("renders its children", () => {
    render(
      <AppContainer>
        <SlayText>Welcome</SlayText>
      </AppContainer>
    );
    expect(screen.getByText("Welcome")).toBeTruthy();
  });

  it("renders flush, fixed-height and with a single safe-area edge", () => {
    render(
      <AppContainer flush fixedHeight edges={["top"]}>
        <SlayText>Mission</SlayText>
      </AppContainer>
    );
    expect(screen.getByText("Mission")).toBeTruthy();
  });
});

describe("Section", () => {
  it.each(SPACINGS)("renders with py=%s", (py) => {
    render(
      <Section py={py}>
        <SlayText>Body</SlayText>
      </Section>
    );
    expect(screen.getByText("Body")).toBeTruthy();
  });

  it("renders its title above the content", () => {
    render(
      <Section title="Vocabulary learned">
        <SlayText>Body</SlayText>
      </Section>
    );
    expect(screen.getByText("Vocabulary learned")).toBeTruthy();
  });

  it("renders no title node when none is given", () => {
    const { container } = render(
      <Section>
        <SlayText>Body</SlayText>
      </Section>
    );
    expect(container.textContent).toBe("Body");
  });

  it("honours pt and pb over py", () => {
    render(
      <Section py="xl" pt="none" pb="sm">
        <SlayText>Body</SlayText>
      </Section>
    );
    expect(screen.getByText("Body")).toBeTruthy();
  });
});

describe("Grid", () => {
  it.each(COLS)("renders %i columns", (cols) => {
    render(
      <Grid cols={cols}>
        {Array.from({ length: cols }, (_, index) => (
          <Text key={index}>{`cell ${index}`}</Text>
        ))}
      </Grid>
    );
    expect(screen.getByText("cell 0")).toBeTruthy();
  });

  it.each(GAPS)("renders with gap=%s", (gap) => {
    render(
      <Grid gap={gap}>
        <Text>cell</Text>
      </Grid>
    );
    expect(screen.getByText("cell")).toBeTruthy();
  });

  it("drops empty children instead of laying out empty cells", () => {
    const { container } = render(
      <Grid cols={2}>
        <Text>one</Text>
        {null}
        {false}
        <Text>two</Text>
      </Grid>
    );
    expect(container.textContent).toBe("onetwo");
  });
});

describe("ScrollScreen", () => {
  it("renders its content", () => {
    render(
      <ScrollScreen>
        <SlayText>Dashboard</SlayText>
      </ScrollScreen>
    );
    expect(screen.getByText("Dashboard")).toBeTruthy();
  });

  it("renders the footer below the scrolling content", () => {
    const { container } = render(
      <ScrollScreen footer={<Text>Tab bar</Text>}>
        <SlayText>Dashboard</SlayText>
      </ScrollScreen>
    );
    expect(container.textContent).toBe("DashboardTab bar");
  });

  it("renders with a top offset and a bottom clearance", () => {
    render(
      <ScrollScreen topOffset={49} bottomClearance={83} footer={<Text>Tab bar</Text>}>
        <SlayText>Dashboard</SlayText>
      </ScrollScreen>
    );
    expect(screen.getByText("Dashboard")).toBeTruthy();
  });
});
