import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { colorForCategory, FEATURED_CATEGORY_COLORS } from "@/lib/categories";

import { CategoryBadge } from "./CategoryBadge";

describe("CategoryBadge", () => {
  it("renders the category name", () => {
    render(<CategoryBadge category={{ id: 1, name: "School", position: 0 }} />);
    expect(screen.getByText("School")).toBeInTheDocument();
  });

  it("tints the dot with the category's border color", () => {
    // Border, not fill — the dot is the saturated accent, and swapping the two
    // is the easy mistake to make when touching this.
    const { container } = render(<CategoryBadge category={{ id: 1, name: "School", position: 0 }} />);
    const dot = container.querySelector("span > span");
    expect(dot).toHaveStyle({ backgroundColor: colorForCategory({ id: 1, position: 0 }).border });
  });

  it("uses the featured accents for the first four categories", () => {
    // Asserts against the literal palette rather than colorForCategory's
    // output, so the badge drifting off the palette fails here even if both
    // sides were rewritten together.
    FEATURED_CATEGORY_COLORS.forEach(({ border }, position) => {
      const id = position + 1;
      const { container } = render(
        <CategoryBadge category={{ id, name: `Category ${id}`, position }} />
      );
      expect(container.querySelector("span > span")).toHaveStyle({ backgroundColor: border });
    });
  });
});
