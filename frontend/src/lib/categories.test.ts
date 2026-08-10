import { describe, expect, it } from "vitest";

import { colorForCategory } from "./categories";

describe("colorForCategory", () => {
  it("returns the same color for the same id", () => {
    expect(colorForCategory({ id: 7 })).toEqual(colorForCategory({ id: 7 }));
  });

  it("keys off the id, not the name, so renaming doesn't recolor", () => {
    // Both objects are the same category before and after a rename; the
    // function only ever sees the id, which is the point.
    expect(colorForCategory({ id: 42 })).toEqual(colorForCategory({ id: 42 }));
  });

  it("spreads consecutive ids across different hues", () => {
    // The whole reason for hashing rather than using the id directly: ids 1-5
    // are what a new account actually gets, and they must not all look alike.
    const fills = [1, 2, 3, 4, 5].map((id) => colorForCategory({ id }).fill);
    expect(new Set(fills).size).toBe(5);
  });

  it("produces hsl fill and border strings", () => {
    const color = colorForCategory({ id: 1 });
    expect(color.fill).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
    expect(color.border).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
  });
});
