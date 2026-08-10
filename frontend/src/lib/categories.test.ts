import { describe, expect, it } from "vitest";

import { colorForCategory, FEATURED_CATEGORY_COLORS } from "./categories";

/** The `--color-ink` token from globals.css — the foreground on every card. */
const INK = "#1f1b16";

/** A category is only ever identified to colorForCategory by these two. */
function category(id: number, position: number) {
  return { id, position };
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const value = parseInt(hex.slice(i, i + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function hueOf(hsl: string): number {
  const match = /^hsl\((\d+) /.exec(hsl);
  if (!match) throw new Error(`not an hsl string: ${hsl}`);
  return Number(match[1]);
}

describe("colorForCategory", () => {
  it("returns the same color for the same category", () => {
    expect(colorForCategory(category(7, 6))).toEqual(colorForCategory(category(7, 6)));
  });

  it("gives the first four categories the featured colors, in order", () => {
    // The order is the requirement, not just the set: category one is the
    // orange, category two the yellow, and so on.
    expect([0, 1, 2, 3].map((position) => colorForCategory(category(90 + position, position)).fill))
      .toEqual(["#EF9C66", "#FCDC94", "#C8CFA0", "#78ABA8"]);
  });

  it("pairs each featured fill with its own deeper border", () => {
    expect([0, 1, 2, 3].map((position) => colorForCategory(category(90 + position, position))))
      .toEqual([...FEATURED_CATEGORY_COLORS]);
  });

  it("keys the featured colors off position, not id", () => {
    // The id sequence is global across users, so the second user to register
    // gets ids starting wherever the first user's left off. Their first four
    // categories still have to be the featured four.
    expect(colorForCategory(category(4071, 0))).toEqual(FEATURED_CATEGORY_COLORS[0]);
  });

  it("keeps the ink foreground readable on every featured fill", () => {
    // Cards and badges render text-ink on top of `fill`; a fill that's too
    // dark for it is a readability bug that's easy to introduce by eye.
    for (const { fill } of FEATURED_CATEGORY_COLORS) {
      expect(contrastRatio(fill, INK)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("hands the fifth category onwards a generated color, not a featured one", () => {
    const featuredFills = new Set(FEATURED_CATEGORY_COLORS.map((c) => c.fill));
    for (const position of [4, 5, 6, 7, 8, 9]) {
      const color = colorForCategory(category(position + 1, position));
      expect(color.fill).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
      expect(color.border).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
      expect(featuredFills.has(color.fill)).toBe(false);
    }
  });

  it("falls back to a generated color for a position that isn't one", () => {
    // Defends the array lookup: a negative or fractional position must not
    // index off the end of the palette and return undefined.
    for (const position of [-1, 1.5, NaN]) {
      expect(colorForCategory(category(12, position)).fill).toMatch(/^hsl\(/);
    }
  });

  it("keys generated colors off the id, so a rename or a deletion above doesn't recolor", () => {
    // Same category, now one place higher because the one above it was
    // deleted — the generated half is deliberately position-independent.
    expect(colorForCategory(category(31, 8))).toEqual(colorForCategory(category(31, 7)));
  });

  it("doesn't walk the generated colors in a fixed order", () => {
    // Past the featured four the color is supposed to be arbitrary-but-stable,
    // so consecutive ids must not march around the wheel in sequence — this
    // is what the hash buys, and a refactor to `hue = id * step` would fail.
    const hues = [5, 6, 7, 8, 9, 10].map((id) => hueOf(colorForCategory(category(id, id)).fill));
    const ascending = hues.every((hue, i) => i === 0 || hue > hues[i - 1]);
    const descending = hues.every((hue, i) => i === 0 || hue < hues[i - 1]);
    expect(ascending || descending).toBe(false);
  });

  it("spreads consecutive ids across the whole wheel", () => {
    // The whole reason for hashing rather than using the id directly: the
    // generated colors must not all look alike.
    //
    // Deliberately not asserting the hues are all distinct. 360 hues and a
    // hash means birthday-paradox collisions are inherent, not a fixable bug
    // in the mix — ids 5 and 7 genuinely share a hue today, and a stronger
    // hash (murmur3's fmix32) just moves the first collision earlier. What
    // has to hold is the spread.
    const hues = [5, 6, 7, 8, 9, 10].map((id) => hueOf(colorForCategory(category(id, id)).fill));
    expect(Math.max(...hues) - Math.min(...hues)).toBeGreaterThan(180);
  });

  it("never returns the shared featured object in a mutable form", () => {
    // colorForCategory hands back the module-level object rather than a copy,
    // so a stray write would recolor that category everywhere, for good.
    expect(Object.isFrozen(colorForCategory(category(1, 0)))).toBe(true);
  });
});
