import { describe, expect, it } from "vitest";

import { GRID, nextHead } from "./snakeGrid";

const LAST = GRID - 1;

describe("nextHead", () => {
  it("moves one cell in the given direction away from the edges", () => {
    expect(nextHead({ x: 5, y: 5 }, "right")).toEqual({ x: 6, y: 5 });
    expect(nextHead({ x: 5, y: 5 }, "left")).toEqual({ x: 4, y: 5 });
    expect(nextHead({ x: 5, y: 5 }, "down")).toEqual({ x: 5, y: 6 });
    expect(nextHead({ x: 5, y: 5 }, "up")).toEqual({ x: 5, y: 4 });
  });

  it("wraps across each edge to the opposite side", () => {
    expect(nextHead({ x: LAST, y: 3 }, "right")).toEqual({ x: 0, y: 3 });
    expect(nextHead({ x: 0, y: 3 }, "left")).toEqual({ x: LAST, y: 3 });
    expect(nextHead({ x: 3, y: LAST }, "down")).toEqual({ x: 3, y: 0 });
    expect(nextHead({ x: 3, y: 0 }, "up")).toEqual({ x: 3, y: LAST });
  });

  it("preserves how far along the other axis the snake entered the edge", () => {
    // Exiting the right edge at row 7 must re-enter the left edge on row 7.
    expect(nextHead({ x: LAST, y: 7 }, "right")).toEqual({ x: 0, y: 7 });
    expect(nextHead({ x: 9, y: 0 }, "up")).toEqual({ x: 9, y: LAST });
  });

  it("keeps every cell on the board across a full lap in each direction", () => {
    for (const direction of ["up", "down", "left", "right"] as const) {
      let cell = { x: 4, y: 4 };
      for (let step = 0; step < GRID * 2; step++) {
        cell = nextHead(cell, direction);
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.x).toBeLessThan(GRID);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeLessThan(GRID);
      }
      // A full lap of GRID steps returns to the start, twice over.
      expect(cell).toEqual({ x: 4, y: 4 });
    }
  });
});
