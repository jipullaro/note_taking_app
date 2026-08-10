import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api";
import { readDraft, writeDraft } from "@/lib/drafts";
import { resetNavigation, routerMock } from "@/test/next-navigation";
import type { Category, Note } from "@/types/note";

import { NoteEditor } from "./NoteEditor";

vi.mock("next/navigation");
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  apiErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}));

const personal: Category = { id: 1, name: "Personal" };
const work: Category = { id: 2, name: "Work" };

const note: Note = {
  id: 7,
  title: "Groceries",
  body: "milk",
  category: personal,
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
  archived_at: null,
};

const mockApiFetch = vi.mocked(apiFetch);

/** apiFetch is generic over its response, which no single fake can satisfy —
 * route by path/method and cast once here rather than at every call site. */
type ApiImpl = (path: string, init?: RequestInit) => Promise<unknown>;

function stubWith(impl: ApiImpl) {
  mockApiFetch.mockImplementation(impl as unknown as typeof apiFetch);
}

/** The happy path: the given categories exist, and creating one returns `created`. */
function stubApi(categories: Category[], created: Category = work) {
  stubWith((path, init = {}) => {
    if (path === "/categories/" && !init.method) return Promise.resolve(categories);
    if (path === "/categories/" && init.method === "POST") return Promise.resolve(created);
    if (path === "/notes/" && init.method === "POST")
      return Promise.resolve({ ...note, id: 9, category: created });
    if (path.startsWith("/notes/") && init.method === "PATCH")
      return Promise.resolve({ ...note, category: created });
    if (path.startsWith("/notes/") && init.method === "DELETE") return Promise.resolve(undefined);
    return Promise.reject(new Error(`unexpected call: ${init.method ?? "GET"} ${path}`));
  });
}

function bodyOf(call: [string, RequestInit?]) {
  return JSON.parse(String(call[1]?.body));
}

describe("NoteEditor categories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavigation();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("creates a category from the dropdown and files the note under it", async () => {
    stubApi([personal]);
    const user = userEvent.setup();
    render(<NoteEditor initialNote={note} />);

    await user.click(await screen.findByRole("button", { name: /personal/i }));
    await user.click(screen.getByRole("button", { name: /new category/i }));
    await user.type(screen.getByLabelText("New category name"), "Work{Enter}");

    const post = mockApiFetch.mock.calls.find(
      ([path, init]) => path === "/categories/" && init?.method === "POST"
    );
    expect(post).toBeDefined();
    expect(bodyOf(post!)).toEqual({ name: "Work" });

    // The new category becomes the selected one...
    expect(await screen.findByRole("button", { name: /work/i })).toBeInTheDocument();

    // ...and the note is re-saved under it. This is the contentRef sync in
    // update(): React state alone wouldn't have reached the save that the
    // category change flushes, which would have sent the old category.
    const patch = mockApiFetch.mock.calls.find(([path]) => path === `/notes/${note.id}/`);
    expect(patch).toBeDefined();
    expect(bodyOf(patch!)).toMatchObject({ category_id: work.id });
  });

  it("keeps the editor usable when the create fails", async () => {
    stubWith((path, init = {}) => {
      if (path === "/categories/" && !init.method) return Promise.resolve([personal]);
      return Promise.reject(new Error("duplicate"));
    });
    const user = userEvent.setup();
    render(<NoteEditor initialNote={note} />);

    await user.click(await screen.findByRole("button", { name: /personal/i }));
    await user.click(screen.getByRole("button", { name: /new category/i }));
    await user.type(screen.getByLabelText("New category name"), "Personal{Enter}");

    await waitFor(() => expect(window.alert).toHaveBeenCalled());
    expect(screen.getByLabelText("New category name")).toHaveValue("Personal");
  });

  it("offers an inline create form instead of a dead end when there are no categories", async () => {
    stubApi([]);
    render(<NoteEditor />);

    expect(await screen.findByLabelText("New category name")).toBeInTheDocument();
    expect(screen.queryByText(/from the sidebar/i)).not.toBeInTheDocument();
  });

  it("creates the first category from that form and opens the editor", async () => {
    stubApi([]);
    const user = userEvent.setup();
    render(<NoteEditor />);

    await user.type(await screen.findByLabelText("New category name"), "Work");
    await user.click(screen.getByRole("button", { name: /create/i }));

    const post = mockApiFetch.mock.calls.find(
      ([path, init]) => path === "/categories/" && init?.method === "POST"
    );
    expect(post).toBeDefined();
    expect(bodyOf(post!)).toEqual({ name: "Work" });

    expect(await screen.findByPlaceholderText("Note Title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /work/i })).toBeInTheDocument();
  });
});

describe("NoteEditor archiving", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavigation();
    stubApi([personal]);
  });

  it("sends no request when the confirm is declined", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<NoteEditor initialNote={note} />);

    await userEvent.click(await screen.findByRole("button", { name: /archive note/i }));

    expect(mockApiFetch).not.toHaveBeenCalledWith(`/notes/${note.id}/`, { method: "DELETE" });
    expect(routerMock.push).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("archives and returns to the dashboard when confirmed", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<NoteEditor initialNote={note} />);

    await userEvent.click(await screen.findByRole("button", { name: /archive note/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(`/notes/${note.id}/`, { method: "DELETE" });
    });
    expect(routerMock.push).toHaveBeenCalledWith("/dashboard");
    confirmSpy.mockRestore();
  });

  it("promises the archive rather than claiming the delete is permanent", async () => {
    // The old copy said "This can't be undone", which stopped being true the
    // moment DELETE started archiving.
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<NoteEditor initialNote={note} />);

    await userEvent.click(await screen.findByRole("button", { name: /archive note/i }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("archive"));
    expect(confirmSpy).not.toHaveBeenCalledWith(expect.stringContaining("can't be undone"));
    confirmSpy.mockRestore();
  });
});

describe("NoteEditor body", () => {
  const MARKDOWN_NOTE: Note = {
    ...note,
    id: 1,
    body: "Shopping for **tonight**:\n- milk\n- eggs",
  };

  /** Renders and waits for the editor body to take over the DOM. */
  async function renderEditor(initial: Note = MARKDOWN_NOTE) {
    const view = render(<NoteEditor initialNote={initial} />);
    const body = await screen.findByLabelText("Note body");
    return { ...view, body };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetNavigation();
    stubApi([personal]);
  });

  it("shows the stored markdown as formatting, in an editable surface", async () => {
    const { container, body } = await renderEditor();

    expect(container.querySelector("strong")).toHaveTextContent("tonight");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(body.textContent).not.toContain("**");
    // The formatting is live, not a read-only preview you have to click into.
    expect(body).toHaveAttribute("contenteditable", "true");
  });

  it("has no textarea — formatting is applied in place", async () => {
    const { container } = await renderEditor();
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("autosaves the body as markdown after typing", async () => {
    const { body } = await renderEditor({ ...MARKDOWN_NOTE, body: "" });

    await userEvent.click(body);
    await userEvent.keyboard("- milk");

    await waitFor(
      () => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          "/notes/1/",
          expect.objectContaining({ method: "PATCH" })
        );
      },
      { timeout: 3000 }
    );

    const saves = mockApiFetch.mock.calls.filter(([path]) => path === "/notes/1/");
    // Markdown, not the editor's HTML — the API's storage format is unchanged.
    expect(JSON.parse(saves.at(-1)![1]?.body as string).body).toBe("- milk");
  });

  it("debounces rather than saving on every keystroke", async () => {
    const { body } = await renderEditor({ ...MARKDOWN_NOTE, body: "" });

    await userEvent.click(body);
    await userEvent.keyboard("hello");

    await waitFor(
      () => expect(mockApiFetch).toHaveBeenCalledWith("/notes/1/", expect.anything()),
      { timeout: 3000 }
    );

    const saves = mockApiFetch.mock.calls.filter(([path]) => path === "/notes/1/");
    expect(saves.length).toBeLessThan(5); // one per character would be 5
  });
});

describe("NoteEditor saving", () => {
  /** A response the test holds open, to keep a save in flight. */
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  const postsTo = (path: string) =>
    mockApiFetch.mock.calls.filter(([p, init]) => p === path && init?.method === "POST");

  beforeEach(() => {
    vi.clearAllMocks();
    resetNavigation();
  });

  it("leaves the server alone when the editor is only opened", async () => {
    stubApi([personal]);
    render(<NoteEditor initialNote={note} />);
    await screen.findByLabelText("Note body");

    // Well past the debounce. Opening a note is not an edit — an autosave
    // that fired here would bump "Last Edited" on every note you glance at.
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    expect(mockApiFetch).not.toHaveBeenCalledWith(
      `/notes/${note.id}/`,
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("creates a new note once, even when a save is still in flight", async () => {
    // The race this covers: the note has no id until the POST comes back, so
    // a second save starting before then used to create a second note.
    const created = deferred<Note>();
    stubWith((path, init = {}) => {
      if (path === "/categories/" && !init.method) return Promise.resolve([personal, work]);
      if (path === "/notes/" && init.method === "POST") return created.promise;
      if (path === "/notes/9/" && init.method === "PATCH")
        return Promise.resolve({ ...note, id: 9, category: work });
      return Promise.reject(new Error(`unexpected call: ${init.method ?? "GET"} ${path}`));
    });

    render(<NoteEditor />);
    const title = await screen.findByPlaceholderText("Note Title");
    await userEvent.type(title, "New");
    await waitFor(() => expect(postsTo("/notes/")).toHaveLength(1), { timeout: 3000 });

    // The POST is slow, so keep typing: the debounce comes round again while
    // the note still has no id, which is when the second one used to go out.
    await userEvent.type(title, " note");
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(postsTo("/notes/")).toHaveLength(1);

    // Same for a category change, which asks for a save immediately.
    await userEvent.click(screen.getByRole("button", { name: /personal/i }));
    await userEvent.click(screen.getByRole("button", { name: /work/i }));
    expect(postsTo("/notes/")).toHaveLength(1);

    created.resolve({ ...note, id: 9, title: "New", category: personal });

    // The queued change goes to the note that now exists, as an update.
    await waitFor(
      () =>
        expect(mockApiFetch).toHaveBeenCalledWith(
          "/notes/9/",
          expect.objectContaining({ method: "PATCH" })
        ),
      { timeout: 3000 }
    );
    expect(postsTo("/notes/")).toHaveLength(1);
  });

  it("leaves no stale draft when the category list lands mid-save", async () => {
    // /categories/ resolving puts the default category into the editor's
    // content ref. That isn't an edit, but a save in flight used to compare
    // by object identity and read it as one — re-writing a draft after the
    // save had just cleared it, which nothing then cleaned up.
    const categories = deferred<Category[]>();
    const patch = deferred<Note>();
    stubWith((path, init = {}) => {
      if (path === "/categories/" && !init.method) return categories.promise;
      if (path === `/notes/${note.id}/` && init.method === "PATCH") return patch.promise;
      return Promise.reject(new Error(`unexpected call: ${init.method ?? "GET"} ${path}`));
    });

    render(<NoteEditor initialNote={note} />);
    await userEvent.type(await screen.findByPlaceholderText("Note Title"), "!");
    await waitFor(
      () =>
        expect(mockApiFetch).toHaveBeenCalledWith(
          `/notes/${note.id}/`,
          expect.objectContaining({ method: "PATCH" })
        ),
      { timeout: 3000 }
    );

    categories.resolve([personal]); // arrives while the save is still out
    patch.resolve({ ...note, title: `${note.title}!` });

    await waitFor(() => expect(readDraft(note.id)).toBeNull(), { timeout: 3000 });
  });

  it("says when a save is failing instead of losing it quietly", async () => {
    stubWith((path, init = {}) => {
      if (path === "/categories/" && !init.method) return Promise.resolve([personal]);
      return Promise.reject(new Error("offline"));
    });

    render(<NoteEditor initialNote={note} />);
    await userEvent.type(await screen.findByPlaceholderText("Note Title"), "!");

    expect(await screen.findByText(/couldn't save/i, undefined, { timeout: 3000 })).toBeVisible();
    // ...and the content is still recoverable, which is what makes the
    // failure survivable rather than just visible.
    expect(readDraft(note.id)).toMatchObject({ title: `${note.title}!` });
  });
});

describe("NoteEditor drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavigation();
    stubApi([personal]);
  });

  it("keeps a local copy of what hasn't been saved yet", async () => {
    render(<NoteEditor initialNote={note} />);
    await userEvent.type(await screen.findByPlaceholderText("Note Title"), "!");

    // Written on the keystroke, not on the save — that's the whole point.
    expect(readDraft(note.id)).toMatchObject({ title: `${note.title}!` });
  });

  it("clears that copy once the content is on the server", async () => {
    render(<NoteEditor initialNote={note} />);
    await userEvent.type(await screen.findByPlaceholderText("Note Title"), "!");

    await waitFor(() => expect(readDraft(note.id)).toBeNull(), { timeout: 3000 });
  });

  it("restores unsaved content instead of the server's older copy", async () => {
    writeDraft(note.id, {
      title: "Groceries for Friday",
      body: "milk and eggs",
      categoryId: personal.id,
    });

    render(<NoteEditor initialNote={note} />);

    expect(await screen.findByDisplayValue("Groceries for Friday")).toBeInTheDocument();
    expect(await screen.findByLabelText("Note body")).toHaveTextContent("milk and eggs");
  });

  it("gets restored content back onto the server", async () => {
    writeDraft(note.id, {
      title: "Groceries for Friday",
      body: "milk and eggs",
      categoryId: personal.id,
    });

    render(<NoteEditor initialNote={note} />);

    await waitFor(
      () => {
        const patch = mockApiFetch.mock.calls.find(([path]) => path === `/notes/${note.id}/`);
        expect(patch).toBeDefined();
        expect(bodyOf(patch!)).toMatchObject({
          title: "Groceries for Friday",
          body: "milk and eggs",
        });
      },
      { timeout: 3000 }
    );
  });

  it("ignores a draft that matches what the server already has", async () => {
    // Nothing to recover, so this must not look like an edit.
    writeDraft(note.id, { title: note.title, body: note.body, categoryId: personal.id });

    render(<NoteEditor initialNote={note} />);
    await screen.findByLabelText("Note body");
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    expect(mockApiFetch).not.toHaveBeenCalledWith(
      `/notes/${note.id}/`,
      expect.objectContaining({ method: "PATCH" })
    );
    expect(readDraft(note.id)).toBeNull();
  });

  it("drops the draft when the note is archived", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    writeDraft(note.id, { title: "unsent", body: "unsent", categoryId: personal.id });

    render(<NoteEditor initialNote={note} />);
    await userEvent.click(await screen.findByRole("button", { name: /archive note/i }));

    await waitFor(() => expect(readDraft(note.id)).toBeNull());
    confirmSpy.mockRestore();
  });
});
