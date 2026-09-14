/** Board geometry and movement rules for the Snake task, kept free of React so they stay unit-testable. */

export const GRID = 12;

export type Direction = "up" | "down" | "left" | "right";

export interface Cell {
  x: number;
  y: number;
}

export const DELTAS: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export const cellKey = (cell: Cell) => `${cell.x},${cell.y}`;

/**
 * Advances one cell, wrapping around the edges: leaving one side re-enters from
 * the opposite one, so no wall is ever fatal. Adding GRID before the modulo
 * keeps -1 wrapping to GRID - 1 instead of staying negative.
 */
export function nextHead(head: Cell, direction: Direction): Cell {
  const delta = DELTAS[direction];
  return {
    x: (head.x + delta.x + GRID) % GRID,
    y: (head.y + delta.y + GRID) % GRID,
  };
}
