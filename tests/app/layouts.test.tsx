import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ParentLayout from "../../app/parent/_layout";
import StudentLayout from "../../app/(student)/_layout";
import TeacherLayout from "../../app/teacher/_layout";

/**
 * `Tabs`/`Tabs.Screen` are declarative route registrations normally consumed
 * by Expo Router's navigator — they render nothing of their own. This stub
 * renders each screen's title as text instead, purely so the layout's screen
 * list (name + title) is assertable without mounting a real navigator. A
 * screen with `href: null` is hidden from the tab bar, so the stub leaves it out.
 */
const hasAnyGroup = vi.hoisted(() => vi.fn());
vi.mock("~/lib/supabase", () => ({ supabase: {} }));
vi.mock("@slay/data", async (importOriginal) => ({ ...(await importOriginal<typeof import("@slay/data")>()), hasAnyGroup }));

vi.mock("expo-router", () => {
  function Tabs({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
  Tabs.Screen = function TabsScreen({ name, options }: { name: string; options?: { title?: string; href?: null } }) {
    return options?.href === null ? null : <span>{options?.title ?? name}</span>;
  };
  return { Tabs };
});

describe("role group layouts", () => {
  function renderStudent() {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StudentLayout />
      </QueryClientProvider>,
    );
  }

  it("(student) declares map, wardrobe, homework and profile tabs", async () => {
    hasAnyGroup.mockResolvedValue(true);
    renderStudent();
    expect(screen.getByText("Map")).toBeTruthy();
    expect(screen.getByText("Wardrobe")).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(await screen.findByText("Homework")).toBeTruthy();
  });

  it("(student) hides Homework from a student in no teacher's group, as the web does", async () => {
    hasAnyGroup.mockResolvedValue(false);
    renderStudent();
    await vi.waitFor(() => expect(hasAnyGroup).toHaveBeenCalled());
    expect(screen.queryByText("Homework")).toBeNull();
  });

  it("teacher declares groups, map and profile tabs", () => {
    render(<TeacherLayout />);
    expect(screen.getByText("Groups")).toBeTruthy();
    expect(screen.getByText("Map")).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();
  });

  it("parent declares progress, map and profile tabs", () => {
    render(<ParentLayout />);
    expect(screen.getByText("Progress")).toBeTruthy();
    expect(screen.getByText("Map")).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();
  });
});
