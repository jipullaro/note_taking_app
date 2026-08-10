import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Category } from "@/types/note";

import { CategoryDropdown } from "./CategoryDropdown";

const personal: Category = { id: 1, name: "Personal", position: 0 };
const work: Category = { id: 2, name: "Work", position: 1 };

function setup(categories: Category[] = [personal, work]) {
  const onChange = vi.fn();
  const onCreate = vi.fn<(name: string) => Promise<Category>>();
  render(
    <CategoryDropdown
      value={personal}
      categories={categories}
      onChange={onChange}
      onCreate={onCreate}
    />
  );
  return { onChange, onCreate, user: userEvent.setup() };
}

function openPanel(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole("button", { name: /personal/i }));
}

describe("CategoryDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the panel when the only category is the selected one", async () => {
    // The old render guard was `open && options.length > 0`, so a user with a
    // single category got no panel at all — exactly when "new category" is the
    // thing they need.
    const { user } = setup([personal]);

    await openPanel(user);

    expect(screen.getByRole("button", { name: /new category/i })).toBeInTheDocument();
  });

  it("reveals an input and creates the trimmed name on Enter", async () => {
    const { onCreate, user } = setup();
    onCreate.mockResolvedValue({ id: 3, name: "Travel", position: 2 });

    await openPanel(user);
    await user.click(screen.getByRole("button", { name: /new category/i }));

    const input = screen.getByLabelText("New category name");
    await user.type(input, "  Travel  {Enter}");

    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Travel");
    // Panel closes on success; the caller selects the new category.
    expect(screen.queryByLabelText("New category name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^work$/i })).not.toBeInTheDocument();
  });

  it("closes on Escape without creating anything", async () => {
    const { onCreate, user } = setup();

    await openPanel(user);
    await user.click(screen.getByRole("button", { name: /new category/i }));
    await user.type(screen.getByLabelText("New category name"), "Travel{Escape}");

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("New category name")).not.toBeInTheDocument();
  });

  it("does not submit a whitespace-only name", async () => {
    const { onCreate, user } = setup();

    await openPanel(user);
    await user.click(screen.getByRole("button", { name: /new category/i }));
    await user.type(screen.getByLabelText("New category name"), "   {Enter}");

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("New category name")).toBeInTheDocument();
  });

  it("keeps the input open with its text when onCreate rejects", async () => {
    // The backend rejects duplicate names case-insensitively; the user has to
    // be able to fix the name without retyping it.
    const { onCreate, user } = setup();
    onCreate.mockRejectedValue(new Error("You already have a category with this name."));

    await openPanel(user);
    await user.click(screen.getByRole("button", { name: /new category/i }));
    await user.type(screen.getByLabelText("New category name"), "Work{Enter}");

    expect(onCreate).toHaveBeenCalledWith("Work");
    expect(screen.getByLabelText("New category name")).toHaveValue("Work");
  });

  it("cancels the input when the user clicks outside", async () => {
    const { onCreate, user } = setup();

    await openPanel(user);
    await user.click(screen.getByRole("button", { name: /new category/i }));
    await user.type(screen.getByLabelText("New category name"), "Travel");
    await user.click(document.body);

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("New category name")).not.toBeInTheDocument();
  });
});
