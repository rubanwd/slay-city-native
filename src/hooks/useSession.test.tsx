import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { queryClient } from "~/lib/query-client";

import { SessionProvider, useSession } from "./useSession";

type Session = { access_token: string };
type AuthStateCallback = (event: string, session: Session | null) => void;

const supabaseAuthMock = vi.hoisted(() => {
  let authStateCallback: AuthStateCallback = () => {};
  const unsubscribe = vi.fn();

  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn((callback: AuthStateCallback) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe } } };
    }),
  };

  return {
    auth,
    unsubscribe,
    fireAuthStateChange: (event: string, session: Session | null) => authStateCallback(event, session),
  };
});

vi.mock("~/lib/supabase", () => ({ supabase: { auth: supabaseAuthMock.auth } }));

describe("useSession", () => {
  it("throws when read outside a SessionProvider", () => {
    expect(() => renderHook(() => useSession())).toThrow(/SessionProvider/);
  });

  it("starts loading, then resolves the session from supabase.auth.getSession", async () => {
    const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.session).toBeNull();
  });

  it("updates the session when onAuthStateChange fires", async () => {
    const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const session: Session = { access_token: "token-1" };
    act(() => {
      supabaseAuthMock.fireAuthStateChange("SIGNED_IN", session);
    });

    expect(result.current.session).toEqual(session);
  });

  it("clears the TanStack Query cache on SIGNED_OUT", async () => {
    queryClient.setQueryData(["profile"], { name: "Test" });
    const clearSpy = vi.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      supabaseAuthMock.fireAuthStateChange("SIGNED_OUT", null);
    });

    expect(clearSpy).toHaveBeenCalled();
    expect(queryClient.getQueryData(["profile"])).toBeUndefined();
  });

  it("unsubscribes from onAuthStateChange on unmount", async () => {
    const { result, unmount } = renderHook(() => useSession(), { wrapper: SessionProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    unmount();

    expect(supabaseAuthMock.unsubscribe).toHaveBeenCalled();
  });
});
