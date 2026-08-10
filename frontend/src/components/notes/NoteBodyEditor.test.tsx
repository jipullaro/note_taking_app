import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NoteBodyEditor } from "./NoteBodyEditor";

/** Mounts the editor and waits for ProseMirror to take over the DOM. */
async function renderEditor(value = "") {
  const onChange = vi.fn();
  const view = render(<NoteBodyEditor value={value} onChange={onChange} />);
  const body = await screen.findByLabelText("Note body");
  return { ...view, body, onChange };
}

describe("NoteBodyEditor", () => {
  it("renders the stored markdown as formatting, not as markers", async () => {
    const { container, body } = await renderEditor("Shopping for **tonight**:\n- milk\n- eggs");

    expect(container.querySelector("strong")).toHaveTextContent("tonight");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(body.textContent).not.toContain("**");
  });

  it("is editable, unlike the read-only renderer it replaced", async () => {
    const { body } = await renderEditor("hi");
    expect(body).toHaveAttribute("contenteditable", "true");
  });

  it("reports markdown back out, not HTML", async () => {
    const { body, onChange } = await renderEditor("");
    await userEvent.click(body);
    await userEvent.keyboard("hello");

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const last = onChange.mock.calls.at(-1)![0];
    expect(last).toBe("hello");
    expect(last).not.toContain("<p>");
  });

  it("turns '- ' into a real bullet as you type it", async () => {
    // The whole point of the rewrite: formatting appears while typing rather
    // than only after clicking away.
    const { container, body, onChange } = await renderEditor("");
    await userEvent.click(body);
    await userEvent.keyboard("- milk");

    await waitFor(() => expect(container.querySelector("li")).not.toBeNull());
    expect(onChange.mock.calls.at(-1)![0]).toBe("- milk");
  });

  it("turns text bold the moment the closing ** is typed", async () => {
    const { container, body, onChange } = await renderEditor("");
    await userEvent.click(body);
    await userEvent.keyboard("**bold**");

    await waitFor(() => expect(container.querySelector("strong")).not.toBeNull());
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    // The markers are consumed, not left sitting in the text.
    expect(body.textContent).toBe("bold");
    expect(onChange.mock.calls.at(-1)![0]).toBe("**bold**");
  });

  it("turns text italic the moment the closing _ is typed", async () => {
    const { container, body } = await renderEditor("");
    await userEvent.click(body);
    await userEvent.keyboard("_soft_");

    await waitFor(() => expect(container.querySelector("em")).not.toBeNull());
    expect(container.querySelector("em")).toHaveTextContent("soft");
    expect(body.textContent).toBe("soft");
  });

  it("shows the placeholder for an empty note", async () => {
    const { container } = await renderEditor("");
    expect(container.querySelector("[data-placeholder]")).toHaveAttribute(
      "data-placeholder",
      "Pour your heart out…"
    );
  });
});
