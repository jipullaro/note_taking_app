import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when a global `afterEach` exists at import
// time, which isn't guaranteed here — do it explicitly so a component left
// mounted by one test can't leak into the next one's queries.
afterEach(() => {
  cleanup();
});

/*
 * jsdom runs no layout engine, so every geometry API returns nothing or is
 * missing outright. ProseMirror (under the Tiptap note body editor) measures
 * the selection to scroll it into view on each transaction, and without these
 * it throws "target.getClientRects is not a function" on the first keystroke.
 *
 * Zeroed rects are the right answer here: the tests assert on document
 * structure and emitted markdown, never on position, and there is no viewport
 * to scroll within anyway.
 */
const EMPTY_RECT = {
  x: 0,
  y: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
} as DOMRect;

const EMPTY_RECT_LIST = {
  length: 0,
  item: () => null,
  [Symbol.iterator]: function* () {},
} as unknown as DOMRectList;

Range.prototype.getBoundingClientRect = () => EMPTY_RECT;
Range.prototype.getClientRects = () => EMPTY_RECT_LIST;
Element.prototype.getClientRects = () => EMPTY_RECT_LIST;

// Same reason: ProseMirror maps click coordinates back to a document position
// via elementFromPoint, which jsdom doesn't implement at all. Returning null
// makes it fall back to placing the caret without hit-testing, which is all a
// layout-less DOM can offer.
document.elementFromPoint = () => null;
