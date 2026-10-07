import { render, screen } from "@testing-library/react";
import { Text } from "react-native";
import { describe, expect, it } from "vitest";

import { SlayButton, type SlayButtonSize, type SlayButtonVariant } from "./SlayButton";

const VARIANTS: SlayButtonVariant[] = ["pink", "green", "ghost"];
const SIZES: SlayButtonSize[] = ["sm", "md", "lg"];

describe("SlayButton", () => {
  it.each(VARIANTS)("renders the %s variant", (variant) => {
    render(<SlayButton variant={variant}>Start</SlayButton>);
    expect(screen.getByRole("button")).toBeTruthy();
    expect(screen.getByText("Start")).toBeTruthy();
  });

  it.each(SIZES)("renders at size %s", (size) => {
    render(<SlayButton size={size}>Start</SlayButton>);
    expect(screen.getByText("Start")).toBeTruthy();
  });

  it("marks itself disabled", () => {
    render(<SlayButton disabled>Start</SlayButton>);
    expect(screen.getByRole("button").getAttribute("aria-disabled")).toBe("true");
  });

  it("disables itself and hides iconRight while loading", () => {
    render(
      <SlayButton loading iconRight={<Text>Next</Text>}>
        Start
      </SlayButton>
    );

    expect(screen.getByRole("button").getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("keeps both icons when it is not loading", () => {
    render(
      <SlayButton iconLeft={<Text>Back</Text>} iconRight={<Text>Next</Text>}>
        Start
      </SlayButton>
    );
    expect(screen.getByText("Back")).toBeTruthy();
    expect(screen.getByText("Next")).toBeTruthy();
  });
});
