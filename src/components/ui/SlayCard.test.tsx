import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SlayCard, type SlayCardVariant } from "./SlayCard";
import { SlayText } from "./SlayText";

const VARIANTS: SlayCardVariant[] = ["pink", "green", "cyan", "purple", "ghost"];

describe("SlayCard", () => {
  it.each(VARIANTS)("renders the %s variant", (variant) => {
    render(
      <SlayCard variant={variant}>
        <SlayText>Coffee Corner</SlayText>
      </SlayCard>
    );
    expect(screen.getByText("Coffee Corner")).toBeTruthy();
  });

  it("renders a static card without a button role", () => {
    render(
      <SlayCard>
        <SlayText>Static</SlayText>
      </SlayCard>
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("becomes pressable when asked", () => {
    const onPress = vi.fn();
    render(
      <SlayCard pressable onPress={onPress}>
        <SlayText>Tap me</SlayText>
      </SlayCard>
    );
    expect(screen.getByText("Tap me")).toBeTruthy();
  });

  it("renders flush, with the header, content and footer sections", () => {
    render(
      <SlayCard flush variant="cyan">
        <SlayCard.Header divided>
          <SlayText>Header</SlayText>
        </SlayCard.Header>
        <SlayCard.Content>
          <SlayText>Content</SlayText>
        </SlayCard.Content>
        <SlayCard.Footer divided>
          <SlayText>Footer</SlayText>
        </SlayCard.Footer>
      </SlayCard>
    );

    expect(screen.getByText("Header")).toBeTruthy();
    expect(screen.getByText("Content")).toBeTruthy();
    expect(screen.getByText("Footer")).toBeTruthy();
  });
});
