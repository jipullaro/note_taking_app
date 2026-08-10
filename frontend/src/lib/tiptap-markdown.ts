import type { JSONContent } from "@tiptap/react";

import { parseMarkdown, type InlineNode } from "./markdown";

/**
 * Markdown <-> ProseMirror document, for the note editor.
 *
 * The API stores note bodies as markdown text and always has. The editor is
 * WYSIWYG, so it needs a document; these two functions are the boundary. Going
 * through markdown (rather than storing the editor's HTML or JSON) keeps the
 * stored format readable, leaves every existing note valid, and lets the
 * dashboard's card previews keep rendering with ./markdown.tsx — the same
 * parser that feeds this one, so the editor and the previews can't disagree
 * about what a note means.
 *
 * The grammar is small enough that the round-trip is lossless: every construct
 * the parser recognises has exactly one serialisation here, and vice versa.
 */

const BOLD = "**";
const ITALIC = "_";

function inlineToProseMirror(nodes: InlineNode[], marks: string[] = []): JSONContent[] {
  return nodes.flatMap((node) => {
    if (node.type === "text") {
      if (node.value === "") return [];
      return [
        {
          type: "text",
          text: node.value,
          ...(marks.length > 0 ? { marks: marks.map((type) => ({ type })) } : {}),
        },
      ];
    }
    // Nested emphasis becomes stacked marks on the same text node, which is how
    // ProseMirror models it — there is no "bold node" wrapping an "italic node".
    return inlineToProseMirror(node.children, [...marks, node.type]);
  });
}

/** Joins a paragraph's lines with hard breaks, which is what a newline means here. */
function paragraphContent(lines: InlineNode[][]): JSONContent[] {
  return lines.flatMap((line, i) => [
    ...(i > 0 ? [{ type: "hardBreak" } as JSONContent] : []),
    ...inlineToProseMirror(line),
  ]);
}

export function markdownToDoc(source: string): JSONContent {
  const blocks = parseMarkdown(source).map<JSONContent>((block) => {
    if (block.type === "list") {
      return {
        type: "bulletList",
        content: block.items.map((item) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: inlineToProseMirror(item) }],
        })),
      };
    }
    return { type: "paragraph", content: paragraphContent(block.lines) };
  });

  // An empty doc still needs one paragraph — ProseMirror's schema requires at
  // least one block, and without it the editor mounts with no place to type.
  return { type: "doc", content: blocks.length > 0 ? blocks : [{ type: "paragraph" }] };
}

/**
 * Wraps text in the markers for its marks.
 *
 * reduceRight, not reduce: marks are listed outermost-first, so the last one
 * has to be applied first for the nesting to come back out in the order it went
 * in. With reduce, "**_x_**" serialises as "_**x**_" — same meaning, but the
 * text churns on every save.
 */
function markUp(text: string, marks: { type: string }[] | undefined): string {
  if (!marks || marks.length === 0) return text;
  return marks.reduceRight((acc, mark) => {
    if (mark.type === "bold") return `${BOLD}${acc}${BOLD}`;
    if (mark.type === "italic") return `${ITALIC}${acc}${ITALIC}`;
    return acc; // an unknown mark degrades to plain text rather than throwing
  }, text);
}

function inlineToMarkdown(content: JSONContent[] | undefined): string {
  if (!content) return "";
  return content
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      if (node.type === "text") return markUp(node.text ?? "", node.marks);
      return "";
    })
    .join("");
}

export function docToMarkdown(doc: JSONContent): string {
  const blocks = (doc.content ?? []).map((block) => {
    if (block.type === "bulletList") {
      return (block.content ?? [])
        .map((item) => {
          // A listItem wraps its text in a paragraph; flatten that away.
          const text = (item.content ?? []).map((p) => inlineToMarkdown(p.content)).join(" ");
          return `- ${text}`;
        })
        .join("\n");
    }
    return inlineToMarkdown(block.content);
  });

  // Blank line between blocks is the separator the parser expects. Trailing
  // empty paragraphs (an editor almost always ends with one) would otherwise
  // serialise to trailing newlines and make every save look like a change.
  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
