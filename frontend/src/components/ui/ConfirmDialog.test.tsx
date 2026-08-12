import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";

const onConfirm = vi.fn();
const onCancel = vi.fn();

function renderDialog(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  return render(
    <ConfirmDialog
      open
      title="Move this note to the archive?"
      description="“Groceries” will be deleted for good a day from now."
      confirmLabel="Move to archive"
      busyLabel="Moving…"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />
  );
}

describe("ConfirmDialog", () => {
  beforeEach(() => {
    onConfirm.mockReset();
    onCancel.mockReset();
  });

  it("renders nothing while closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a modal dialog named and described by its own copy", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Move this note to the archive?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(/deleted for good/);
  });

  it("moves focus to Cancel, so a stray Enter doesn't destroy anything", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("returns focus to whatever opened it", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    const { rerender } = renderDialog();
    rerender(
      <ConfirmDialog
        open={false}
        title="Move this note to the archive?"
        confirmLabel="Move to archive"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("cancels on Escape", async () => {
    renderDialog();

    await userEvent.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancels on a click outside the panel", async () => {
    renderDialog();

    // The backdrop is the dialog's parent; clicking the panel must not cancel.
    await userEvent.click(screen.getByRole("dialog"));
    expect(onCancel).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("confirms when the destructive button is pressed", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Move to archive" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab inside the dialog", async () => {
    renderDialog();

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Move to archive" });

    await userEvent.tab();
    expect(confirm).toHaveFocus();
    await userEvent.tab();
    expect(cancel).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it("locks itself down while the confirmed action is in flight", async () => {
    renderDialog({ busy: true });

    expect(screen.getByRole("button", { name: "Moving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    // Nothing to back out of once the request has left; Escape and the
    // backdrop stop working rather than pretending they undid it.
    await userEvent.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();
  });
});
