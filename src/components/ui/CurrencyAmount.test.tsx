import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CoinAmount, XpAmount } from "./CurrencyAmount";

describe("CoinAmount", () => {
  it("renders the amount", () => {
    render(<CoinAmount value={120} />);
    expect(screen.getByText("120")).toBeTruthy();
  });

  it("takes a preformatted signed string", () => {
    render(<CoinAmount value="+30" />);
    expect(screen.getByText("+30")).toBeTruthy();
  });

  it("exposes the label to assistive tech when given one", () => {
    render(<CoinAmount value={49} label="49 coins" />);
    expect(screen.getByLabelText("49 coins")).toBeTruthy();
  });

  it("renders at a larger type variant", () => {
    render(<CoinAmount value={5} variant="h2" />);
    expect(screen.getByText("5")).toBeTruthy();
  });
});

describe("XpAmount", () => {
  it("renders the amount", () => {
    render(<XpAmount value={340} />);
    expect(screen.getByText("340")).toBeTruthy();
  });

  it("exposes the label to assistive tech when given one", () => {
    render(<XpAmount value={340} label="340 XP" />);
    expect(screen.getByLabelText("340 XP")).toBeTruthy();
  });
});
