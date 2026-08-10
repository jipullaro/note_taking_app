import { describe, expect, it } from "vitest";

import { docToMarkdown, markdownToDoc } from "./tiptap-markdown";

/** markdown -> doc -> markdown, which is what a note survives on every save. */
function roundTrip(source: string): string {
  return docToMarkdown(markdownToDoc(source));
}

describe("markdownToDoc", () => {
  it("turns bullet lines into a bulletList", () => {
    const doc = markdownToDoc("- milk\n- eggs");
    expect(doc.content).toHaveLength(1);
    expect(doc.content?.[0].type).toBe("bulletList");
    expect(doc.content?.[0].content).toHaveLength(2);
  });

  it("marks bold and italic text", () => {
    const doc = markdownToDoc("a **b** and _c_");
    const text = doc.content?.[0].content ?? [];
    expect(text.find((n) => n.text === "b")?.marks).toEqual([{ type: "bold" }]);
    expect(text.find((n) => n.text === "c")?.marks).toEqual([{ type: "italic" }]);
  });

  it("stacks marks for nested emphasis", () => {
    // ProseMirror has no bold-node-wrapping-an-italic-node; it's two marks on
    // one text node, which is why the parser's nesting has to flatten here.
    const doc = markdownToDoc("**_both_**");
    const [text] = doc.content?.[0].content ?? [];
    expect(text.marks?.map((m) => m.type).sort()).toEqual(["bold", "italic"]);
  });

  it("gives an empty body one paragraph to type into", () => {
    // ProseMirror's schema requires at least one block; without this the
    // editor mounts with nowhere to put the caret.
    expect(markdownToDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("keeps a paragraph's internal newlines as hard breaks", () => {
    const doc = markdownToDoc("one\ntwo");
    expect(doc.content?.[0].content?.map((n) => n.type)).toEqual(["text", "hardBreak", "text"]);
  });
});

describe("docToMarkdown", () => {
  it("serialises a bulletList back to markers", () => {
    expect(roundTrip("- milk\n- eggs")).toBe("- milk\n- eggs");
  });

  it("drops the trailing empty paragraph an editor leaves behind", () => {
    // Without the trim, every save of an untouched note would look like a
    // change because of a stray trailing newline.
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hi" }] },
        { type: "paragraph" },
      ],
    };
    expect(docToMarkdown(doc)).toBe("hi");
  });

  it("ignores marks it has no syntax for rather than throwing", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hi", marks: [{ type: "strike" }] }] },
      ],
    };
    expect(docToMarkdown(doc)).toBe("hi");
  });
});

describe("round trip", () => {
  it.each([
    ["plain prose", "Just some words."],
    ["bold", "a **b** c"],
    ["italic", "a _b_ c"],
    ["a bullet list", "- milk\n- eggs"],
    ["prose then a list", "Shopping:\n\n- milk\n- eggs"],
    ["two paragraphs", "one\n\ntwo"],
    ["a line break inside a paragraph", "one\ntwo"],
    ["nested emphasis", "**_both_**"],
  ])("preserves %s", (_label, source) => {
    expect(roundTrip(source)).toBe(source);
  });

  it("normalises * bullets and __/* emphasis to one spelling", () => {
    // Both spellings parse; only one is emitted. The text changes on first
    // save, which is expected — the meaning does not.
    expect(roundTrip("* milk")).toBe("- milk");
    expect(roundTrip("__b__")).toBe("**b**");
    expect(roundTrip("*i*")).toBe("_i_");
  });

  it("leaves snake_case alone", () => {
    // The reason underscore emphasis needs word-boundary guards at all.
    expect(roundTrip("call some_function_name now")).toBe("call some_function_name now");
  });

  it("does not let hostile markup become a node", () => {
    const hostile = "<script>alert(1)</script>";
    const doc = markdownToDoc(hostile);
    // It survives as text, exactly as typed — there is no HTML parse step
    // anywhere on this path, so there is nothing for a tag to become.
    expect(doc.content?.[0].content?.[0].text).toBe(hostile);
    expect(roundTrip(hostile)).toBe(hostile);
  });
});
