import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { colorForCategory } from "@/lib/categories";

import { CategoryBadge } from "./CategoryBadge";

describe("CategoryBadge", () => {
  it("renders the category name", () => {
    render(<CategoryBadge category={{ id: 1, name: "School" }} />);
    expect(screen.getByText("School")).toBeInTheDocument();
  });

  it("tints the dot with the category's border color", () => {
    // Border, not fill — the dot is the saturated accent, and swapping the two
    // is the easy mistake to make when touching this.
    const { container } = render(<CategoryBadge category={{ id: 1, name: "School" }} />);
    const dot = container.querySelector("span > span");
    expect(dot).toHaveStyle({ backgroundColor: colorForCategory({ id: 1 }).border });
  });
});
