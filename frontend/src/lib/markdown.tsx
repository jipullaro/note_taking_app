import { Fragment, type ReactNode } from "react";

/*
 * A deliberately tiny Markdown subset for note bodies. The grammar it accepts,
 * in full:
 *
 *   BLOCKS (line-based)
 *     "- item" / "* item"   consecutive bullet lines become ONE list, one item
 *                           each. Any non-bullet line closes the list.
 *     ""                    a blank line ends the current block (paragraphs are
 *                           separated by blank lines).
 *     anything else         paragraph text. Consecutive plain lines stay in the
 *                           same paragraph, separated by a line break — notes
 *                           were rendered with `whitespace-pre-line` before this
 *                           existed, so a single newline has always meant a
 *                           visible break.
 *
 *   INLINE (per line, nestable)
 *     "**bold**" / "__bold__"      bold
 *     "*italic*" / "_italic_"      italic
 *     everything else              literal text, including unmatched markers
 *
 * There is no heading, link, or code support. Anything the grammar doesn't
 * recognise passes through verbatim, so a note written as plain prose renders
 * exactly as it did before any of this existed.
 *
 * This module is the single source of truth for the grammar. It parses to a
 * small AST which then feeds two consumers: the React renderer below (used for
 * dashboard card previews) and the ProseMirror document converter in
 * ./tiptap-markdown.ts (used by the editor). They must agree on what a note
 * means, so they share the parse rather than each rolling their own.
 *
 * SECURITY — this is the app's only path that turns user content into markup,
 * and the guarantee is structural: every function here returns React *elements*
 * and puts user text in as a *child*, never an HTML string and never
 * dangerouslySetInnerHTML. React escapes text children, so "<script>" in a note
 * body can only ever become the visible characters "<script>" — there is no
 * point at which markup could be parsed out of user input, which is why no
 * sanitizer is needed. See markdown.test.tsx for the assertion of that.
 */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "italic"; children: InlineNode[] };

export type BlockNode =
  /** `lines` rather than one string: a paragraph keeps its internal breaks. */
  | { type: "paragraph"; lines: InlineNode[][] }
  | { type: "list"; items: InlineNode[][] };

/** "- item" or "* item" (a marker, then at least one space). Captures the item. */
const BULLET_LINE = /^[ \t]*[-*][ \t]+(.*)$/;

/**
 * Emphasis, doubles before singles so "**x**" isn't read as two "*x*".
 *
 * Asterisk spans may not contain "*", which keeps stray markers ("2 * 3 * 4")
 * literal instead of letting them pair up across a line. Underscore spans
 * additionally require a non-word character on each side, so `snake_case_name`
 * and `__init__` stay literal — the case that makes naive "_" support annoying
 * for anyone who writes about code.
 */
const EMPHASIS =
  /\*\*([^*]+)\*\*|(?<!\w)__([^_]+)__(?!\w)|\*([^*]+)\*|(?<!\w)_([^_]+)_(?!\w)/g;

/** Parses one line's emphasis into inline nodes. Recurses, so "**_x_**" nests. */
export function parseInline(line: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  // Fresh regex per call: /g regexes carry `lastIndex` between uses.
  const emphasis = new RegExp(EMPHASIS.source, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = emphasis.exec(line)) !== null) {
    if (match.index > cursor) {
      nodes.push({ type: "text", value: line.slice(cursor, match.index) });
    }
    const [whole, boldStar, boldUnderscore, italicStar, italicUnderscore] = match;
    const bold = boldStar ?? boldUnderscore;
    const italic = italicStar ?? italicUnderscore;
    nodes.push(
      bold !== undefined
        ? { type: "bold", children: parseInline(bold) }
        : { type: "italic", children: parseInline(italic) }
    );
    cursor = match.index + whole.length;
  }

  if (cursor < line.length) nodes.push({ type: "text", value: line.slice(cursor) });
  return nodes;
}

/** Parses a note body into blocks. Returns [] for an empty or blank body. */
export function parseMarkdown(source: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let bullets: InlineNode[][] = [];
  let paragraph: InlineNode[][] = [];

  function flushList() {
    if (bullets.length === 0) return;
    blocks.push({ type: "list", items: bullets });
    bullets = [];
  }

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", lines: paragraph });
    paragraph = [];
  }

  for (const line of source.split("\n")) {
    const bullet = BULLET_LINE.exec(line);
    if (bullet) {
      flushParagraph(); // a bullet run starts a new block
      bullets.push(parseInline(bullet[1]));
      continue;
    }

    // Any non-bullet line — blank or not — closes an open list.
    flushList();
    if (line.trim() === "") {
      flushParagraph();
    } else {
      paragraph.push(parseInline(line));
    }
  }

  flushList();
  flushParagraph();
  return blocks;
}

function renderInlineNodes(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    if (node.type === "text") return <Fragment key={i}>{node.value}</Fragment>;
    if (node.type === "bold") {
      return (
        <strong key={i} className="font-semibold text-ink">
          {renderInlineNodes(node.children)}
        </strong>
      );
    }
    return (
      <em key={i} className="italic">
        {renderInlineNodes(node.children)}
      </em>
    );
  });
}

/** Convenience wrapper for callers that just want one line's inline markup. */
export function renderInline(line: string): ReactNode[] {
  return renderInlineNodes(parseInline(line));
}

/**
 * Parses a note body into block-level React elements: <ul> for runs of bullet
 * lines, <p> for everything else. Returns [] for an empty/blank body so callers
 * can render nothing at all.
 */
export function renderMarkdown(source: string): ReactNode[] {
  return parseMarkdown(source).map((block, i) => {
    if (block.type === "list") {
      return (
        <ul key={i} className="list-disc space-y-1 pl-5">
          {block.items.map((item, j) => (
            <li key={j}>{renderInlineNodes(item)}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i}>
        {block.lines.map((line, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {renderInlineNodes(line)}
          </Fragment>
        ))}
      </p>
    );
  });
}
