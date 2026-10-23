import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { reportError } from "~/lib/errorReporting";

import { RouteError } from "./RouteError";

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("expo-router", () => ({ useRouter: () => nav }));
vi.mock("~/lib/errorReporting", () => ({ reportError: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

describe("RouteError", () => {
  it("apologises, and reports the error once with where it happened", () => {
    const error = new Error("boom");
    render(<RouteError error={error} retry={vi.fn(async () => {})} where="student" />);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(error, { where: "student" });
  });

  it("tries the screen again", async () => {
    const retry = vi.fn(async () => {});
    render(<RouteError error={new Error("boom")} retry={retry} where="teacher" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(retry).toHaveBeenCalled();
  });

  it("goes home", () => {
    render(<RouteError error={new Error("boom")} retry={vi.fn(async () => {})} where="root" />);
    fireEvent.click(screen.getByRole("button", { name: "Go home" }));
    expect(nav.replace).toHaveBeenCalledWith("/");
  });

  it("speaks the console's language", () => {
    render(<RouteError error={new Error("boom")} retry={vi.fn(async () => {})} where="parent" locale="uk" />);
    expect(screen.getByRole("heading", { name: "Щось пішло не так" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Спробувати ще" })).toBeTruthy();
  });
});
