import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoteBody } from "./NoteBody";

describe("NoteBody", () => {
  it("renders real elements for a mixed body", () => {
    const { container } = render(
      <NoteBody body={"Shopping for **tonight**:\n\n- milk\n- eggs"} />
    );

    expect(container.querySelector("strong")).toHaveTextContent("tonight");
    const list = container.querySelector("ul");
    expect(list).not.toBeNull();
    expect(list!.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders nothing for an empty body", () => {
    const { container } = render(<NoteBody body="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("passes the caller's type styling through to the wrapper", () => {
    const { container } = render(<NoteBody body="hello" className="text-sm" />);
    expect(container.firstElementChild).toHaveClass("text-sm");
  });
});
