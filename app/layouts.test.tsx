import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ParentLayout from "./(parent)/_layout";
import StudentLayout from "./(student)/_layout";
import TeacherLayout from "./(teacher)/_layout";

/**
 * `Tabs`/`Tabs.Screen` are declarative route registrations normally consumed
 * by Expo Router's navigator — they render nothing of their own. This stub
 * renders each screen's title as text instead, purely so the layout's screen
 * list (name + title) is assertable without mounting a real navigator.
 */
vi.mock("expo-router", () => {
  function Tabs({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
  Tabs.Screen = function TabsScreen({ name, options }: { name: string; options?: { title?: string } }) {
    return <span>{options?.title ?? name}</span>;
  };
  return { Tabs };
});

describe("role group layouts", () => {
  it("(student) declares map, wardrobe, homework and profile tabs", () => {
    render(<StudentLayout />);
    expect(screen.getByText("Map")).toBeTruthy();
    expect(screen.getByText("Wardrobe")).toBeTruthy();
    expect(screen.getByText("Homework")).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();
  });

  it("(teacher) declares groups, map and profile tabs", () => {
    render(<TeacherLayout />);
    expect(screen.getByText("Groups")).toBeTruthy();
    expect(screen.getByText("Map")).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();
  });

  it("(parent) declares progress, map and profile tabs", () => {
    render(<ParentLayout />);
    expect(screen.getByText("Progress")).toBeTruthy();
    expect(screen.getByText("Map")).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();
  });
});
