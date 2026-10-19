import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RouteGuard } from "./RouteGuard";

const nav = vi.hoisted(() => ({ pathname: "/", params: {} as Record<string, string>, replace: vi.fn() }));
const session = vi.hoisted(() => ({ current: { session: null as object | null, isLoading: false } }));
const loadAccount = vi.hoisted(() => vi.fn());

vi.mock("expo-router", () => ({
  usePathname: () => nav.pathname,
  useGlobalSearchParams: () => nav.params,
  useRouter: () => ({ replace: nav.replace }),
}));
vi.mock("~/hooks/useSession", () => ({ useSession: () => session.current }));
vi.mock("~/lib/supabase", () => ({ supabase: {} }));
vi.mock("@slay/data", () => ({ loadAccount, signOut: vi.fn() }));

const signedIn = { session: { user: { id: "u1" } }, isLoading: false };

function renderGuard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RouteGuard>
        <span>screen</span>
      </RouteGuard>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  nav.pathname = "/";
  nav.params = {};
  nav.replace.mockReset();
  loadAccount.mockReset();
  session.current = { session: null, isLoading: false };
});

describe("RouteGuard", () => {
  it("covers a protected deep link and sends a signed-out visitor to login with the target", () => {
    nav.pathname = "/teacher/map";
    renderGuard();

    expect(nav.replace).toHaveBeenCalledWith("/auth/login?next=%2Fteacher%2Fmap");
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(loadAccount).not.toHaveBeenCalled();
  });

  it("keeps the cover up while the session is still loading", () => {
    session.current = { session: null, isLoading: true };
    nav.pathname = "/auth/login";
    renderGuard();

    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("shows an allowed screen without a cover", async () => {
    session.current = signedIn;
    nav.pathname = "/map";
    loadAccount.mockResolvedValue({ kind: "profile", role: "student" });
    renderGuard();

    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("moves a teacher off the student map to their own home", async () => {
    session.current = signedIn;
    nav.pathname = "/map";
    loadAccount.mockResolvedValue({ kind: "profile", role: "teacher" });
    renderGuard();

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/teacher"));
  });

  it("follows `next` after sign-in", async () => {
    session.current = signedIn;
    nav.pathname = "/auth/login";
    nav.params = { next: "/parent/profile" };
    loadAccount.mockResolvedValue({ kind: "profile", role: "parent" });
    renderGuard();

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/parent/profile"));
  });

  it("offers a retry when the account cannot be loaded", async () => {
    session.current = signedIn;
    nav.pathname = "/map";
    loadAccount.mockRejectedValue(new Error("offline"));
    renderGuard();

    expect(await screen.findByText("Could not load your account. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
