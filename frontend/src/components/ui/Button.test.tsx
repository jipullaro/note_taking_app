import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlusIcon } from "./icons";
import { Button } from "./Button";

describe("Button", () => {
  it("renders a link when given href, and a button otherwise", () => {
    const { rerender } = render(<Button href="/notes/new">New Note</Button>);
    expect(screen.getByRole("link", { name: "New Note" })).toHaveAttribute("href", "/notes/new");

    rerender(<Button>New Note</Button>);
    expect(screen.getByRole("button", { name: "New Note" })).toBeInTheDocument();
  });

  it("passes attributes through on the link branch too", () => {
    // The href branch rendered <Link> with only href and className for a
    // while, so a title or an aria-* on a link-shaped Button went nowhere.
    render(
      <Button href="/notes/new" title="New Note" data-testid="action">
        New Note
      </Button>
    );

    expect(screen.getByTestId("action")).toHaveAttribute("title", "New Note");
  });

  it("keeps its accessible name when the label is visually hidden", () => {
    // How the dashboard renders it on a phone: a "+" with the words kept for
    // screen readers, so the shrunk button is still a named link.
    render(
      <Button href="/notes/new" icon={<PlusIcon className="size-4" />} title="New Note">
        <span className="max-md:sr-only">New Note</span>
      </Button>
    );

    expect(screen.getByRole("link", { name: "New Note" })).toBeInTheDocument();
  });
});
