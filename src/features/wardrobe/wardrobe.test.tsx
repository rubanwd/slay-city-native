import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WardrobeItem } from "@slay/data";

import { WardrobeLoader } from "./WardrobeLoader";
import { WardrobeScreen } from "./WardrobeScreen";

const data = vi.hoisted(() => ({
  loadWardrobe: vi.fn(),
  purchaseWardrobeItem: vi.fn(),
  equipWardrobeItem: vi.fn(),
  unequipWardrobeItem: vi.fn(),
}));

vi.mock("@slay/data", () => data);
vi.mock("~/lib/supabase", () => ({ supabase: {} }));
vi.mock("~/lib/imageSource", () => ({ imageSource: (url: string | null) => (url ? { uri: url } : null) }));
vi.mock("~/features/map", () => ({ MAP_QUERY_KEY: "map" }));

afterEach(() => {
  vi.clearAllMocks();
});

const item = (over: Partial<WardrobeItem>): WardrobeItem => ({
  id: "x",
  name: "Item",
  description: null,
  category: "hat",
  imageUrl: null,
  cost: 10,
  unlockLevel: null,
  isDefault: false,
  owned: false,
  equipped: false,
  ...over,
});

const items = [
  item({ id: "base", name: "Classic", isDefault: true, owned: true, equipped: true }),
  item({ id: "cap", name: "Cap", cost: 10 }),
  item({ id: "crown", name: "Crown", cost: 500 }),
  item({ id: "wizard", name: "Wizard", cost: 5, unlockLevel: 9 }),
  item({ id: "shades", name: "Shades", category: "glasses", owned: true }),
  item({ id: "old", name: "Old colour", category: "color", owned: true }),
];

describe("WardrobeScreen", () => {
  function renderScreen(onAction = vi.fn()) {
    render(<WardrobeScreen items={items} coins={40} level={2} mascotImageUrl="/wardrobe/slay-base.webp" onAction={onAction} />);
    return onAction;
  }

  it("groups the catalog by category and hides retired ones", () => {
    renderScreen();
    expect(screen.getByText("Hats")).toBeTruthy();
    expect(screen.getByText("Glasses")).toBeTruthy();
    expect(screen.queryByText("Old colour")).toBeNull();
    expect(screen.getByLabelText("40 coins")).toBeTruthy();
  });

  it("offers the right action for each item", () => {
    const onAction = renderScreen();

    expect(screen.getByText("ON")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Take off Classic" }));
    expect(onAction).toHaveBeenLastCalledWith(items[0], "unequip");

    fireEvent.click(screen.getByRole("button", { name: "Buy Cap for 10 coins" }));
    expect(onAction).toHaveBeenLastCalledWith(items[1], "buy");

    // Too dear: the price button is disabled.
    expect(screen.getByRole("button", { name: "Buy Crown for 500 coins" }).getAttribute("aria-disabled")).toBe("true");
    // Above the player's level: locked, no button at all.
    expect(screen.getByLabelText("Wizard: unlocks at level 9")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Wizard/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Wear Shades" }));
    expect(onAction).toHaveBeenLastCalledWith(items[4], "equip");
  });

  it("says when the shop is empty", () => {
    render(<WardrobeScreen items={[]} coins={0} level={1} mascotImageUrl="/wardrobe/slay-base.webp" onAction={vi.fn()} />);
    expect(screen.getByText("No items in the shop yet. Check back soon!")).toBeTruthy();
  });
});

describe("WardrobeLoader", () => {
  function renderLoader() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(
      <QueryClientProvider client={client}>
        <WardrobeLoader />
      </QueryClientProvider>,
    );
    return invalidate;
  }

  it("buys an item, then refreshes the wardrobe and the map's mascot", async () => {
    data.loadWardrobe.mockResolvedValue({ items, coins: 40, level: 2, mascotImageUrl: "/wardrobe/slay-base.webp" });
    data.purchaseWardrobeItem.mockResolvedValue({ ok: true, coinsRemaining: 30 });
    const invalidate = renderLoader();

    fireEvent.click(await screen.findByRole("button", { name: "Buy Cap for 10 coins" }));
    await waitFor(() => expect(data.purchaseWardrobeItem).toHaveBeenCalledWith({}, "cap"));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["map"] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["wardrobe"] });
  });

  it("shows why a purchase failed", async () => {
    data.loadWardrobe.mockResolvedValue({ items, coins: 40, level: 2, mascotImageUrl: "/wardrobe/slay-base.webp" });
    data.purchaseWardrobeItem.mockResolvedValue({ ok: false, error: "You don't have enough coins for this item." });
    renderLoader();

    fireEvent.click(await screen.findByRole("button", { name: "Buy Cap for 10 coins" }));
    expect((await screen.findByRole("alert")).textContent).toBe("You don't have enough coins for this item.");
  });

  it("offers a retry when the wardrobe can't load", async () => {
    data.loadWardrobe.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ items: [], coins: 0, level: 1, mascotImageUrl: "/x" });
    renderLoader();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No items in the shop yet. Check back soon!")).toBeTruthy();
  });
});
