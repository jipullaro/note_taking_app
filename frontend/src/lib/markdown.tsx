import { Fragment, type ReactNode } from "react";

/*
 * A deliberately tiny Markdown subset for note bodies. The grammar it accepts,
 * in full:
 *
 *   BLOCKS (line-based)
 *     "- item" / "* item"   consecutive bullet lines become ONE <ul>, one <li>
 *                           each. Any non-bullet line closes the list.
 *     ""                    a blank line ends the current block (paragraphs are
 *                           separated by blank lines).
 *     anything else         paragraph text. Consecutive plain lines stay in the
 *                           same <p>, separated by <br /> — notes were rendered
 *                           with `whitespace-pre-line` before this existed, so a
 *                           single newline has always meant a visible break.
 *
 *   INLINE (per line)
 *     "**bold**"            <strong>, anywhere in the line
 *     "*italic*"            <em>, anywhere in the line
 *     everything else       literal text, including unmatched "*" / "**"
 *
 * There is no nesting, no headings, no links, no code spans. Anything the
 * grammar doesn't recognise is passed through verbatim, so a note written as
 * plain prose renders exactly as it did before.
 *
 * SECURITY — this is the app's only path that turns user content into markup,
 * and the guarantee is structural: every function here returns React *elements*
 * and puts user text in as a *child*, never an HTML string and never
 * dangerouslySetInnerHTML. React escapes text children, so "<script>" in a note
 * body can only ever become the visible characters "<script>" — there is no
 * point at which markup could be parsed out of user input, which is why no
 * sanitizer is needed. See markdown.test.tsx for the assertion of that.
 */

/** "- item" or "* item" (a marker, then at least one space). Captures the item. */
const BULLET_LINE = /^[ \t]*[-*][ \t]+(.*)$/;

/**
 * "**bold**" or "*italic*". Emphasis spans may not themselves contain "*",
 * which keeps unmatched or stray markers (e.g. "2 * 3 * 4", "a ** b") literal
 * rather than letting them pair up across the line.
 */
const EMPHASIS = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;

/** Splits one line into text, <strong> and <em> nodes. */
export function renderInline(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Fresh regex per call: /g regexes carry `lastIndex` between uses.
  const emphasis = new RegExp(EMPHASIS.source, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = emphasis.exec(line)) !== null) {
    if (match.index > cursor) nodes.push(line.slice(cursor, match.index));
    const [whole, bold, italic] = match;
    nodes.push(
      bold !== undefined ? (
        <strong key={match.index} className="font-semibold text-ink">
          {bold}
        </strong>
      ) : (
        <em key={match.index} className="italic">
          {italic}
        </em>
      )
    );
    cursor = match.index + whole.length;
  }

  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes;
}

/**
 * Parses a note body into block-level React elements: <ul> for runs of bullet
 * lines, <p> for everything else. Returns [] for an empty/blank body so callers
 * can render nothing at all.
 */
export function renderMarkdown(source: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let bullets: string[] = []; // pending <li> texts
  let paragraph: string[] = []; // pending lines of the current <p>

  function flushList() {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  }

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const lines = paragraph;
    paragraph = [];
    blocks.push(
      <p key={`p-${blocks.length}`}>
        {lines.map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {renderInline(line)}
          </Fragment>
        ))}
      </p>
    );
  }

  for (const line of source.split("\n")) {
    const bullet = BULLET_LINE.exec(line);
    if (bullet) {
      flushParagraph(); // a bullet run starts a new block
      bullets.push(bullet[1]);
      continue;
    }

    // Any non-bullet line — blank or not — closes an open list.
    flushList();
    if (line.trim() === "") {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  }

  flushList();
  flushParagraph();
  return blocks;
}
