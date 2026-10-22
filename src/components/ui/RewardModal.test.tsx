import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RewardModal } from "./RewardModal";
import { SlayText } from "./SlayText";

describe("RewardModal", () => {
  it("shows its title, copy and rewards, and Continue closes it", () => {
    const onClose = vi.fn();
    render(
      <RewardModal
        open
        onClose={onClose}
        title="AMAZING!"
        description="You found every word."
        rewards={<SlayText>+30 XP</SlayText>}
      />,
    );

    expect(screen.getByText("AMAZING!")).toBeTruthy();
    expect(screen.getByText("You found every word.")).toBeTruthy();
    expect(screen.getByText("+30 XP")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the × too, and takes a custom action", () => {
    const onClose = vi.fn();
    const claim = vi.fn();
    render(
      <RewardModal
        open
        onClose={onClose}
        title="Level up"
        action={
          <SlayText accessibilityRole="button" onPress={claim}>
            Claim
          </SlayText>
        }
      />,
    );

    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Claim" }));
    expect(claim).toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "Close reward" }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing while closed", () => {
    render(<RewardModal open={false} onClose={vi.fn()} title="Hidden" />);
    expect(screen.queryByText("Hidden")).toBeNull();
  });
});
