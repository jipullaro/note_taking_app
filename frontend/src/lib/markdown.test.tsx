import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./markdown";

// .tsx rather than .ts: the parser returns React elements (that's the security
// property), so asserting on them means rendering them.
function renderBody(source: string) {
  return render(<div data-testid="body">{renderMarkdown(source)}</div>);
}

describe("renderMarkdown — blocks", () => {
  it("returns nothing for an empty or blank body", () => {
    expect(renderMarkdown("")).toEqual([]);
    expect(renderMarkdown("   \n\n  ")).toEqual([]);
  });

  it("groups consecutive '- ' lines into ONE <ul> with an <li> each", () => {
    const { container } = renderBody("- milk\n- eggs\n- bread");
    const lists = container.querySelectorAll("ul");
    expect(lists).toHaveLength(1);
    expect([...lists[0].querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "milk",
      "eggs",
      "bread",
    ]);
  });

  it("treats '* ' as a bullet marker too, in the same list", () => {
    const { container } = renderBody("* milk\n- eggs");
    expect(container.querySelectorAll("ul")).toHaveLength(1);
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("closes the list on a non-bullet line", () => {
    const { container } = renderBody("- milk\n- eggs\nthen go home\n- and rest");
    expect(container.querySelectorAll("ul")).toHaveLength(2);
    expect(container.querySelectorAll("ul")[0].querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelectorAll("ul")[1].querySelectorAll("li")).toHaveLength(1);
    expect(container.querySelector("p")).toHaveTextContent("then go home");
  });

  it("does not treat a bare '*' or '-' without a space as a bullet", () => {
    const { container } = renderBody("*not a bullet*\n-3 degrees");
    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector("p")).toHaveTextContent("not a bullet-3 degrees");
  });

  it("splits paragraphs on blank lines", () => {
    const { container } = renderBody("first thought\n\nsecond thought");
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toHaveTextContent("first thought");
    expect(paragraphs[1]).toHaveTextContent("second thought");
  });

  it("keeps single newlines as breaks inside one paragraph", () => {
    const { container } = renderBody("line one\nline two");
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelectorAll("br")).toHaveLength(1);
  });

  it("round-trips plain prose with no markers", () => {
    const prose = "Just an ordinary note about the weather.";
    const { container } = renderBody(prose);
    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector("strong")).toBeNull();
    expect(container.querySelector("em")).toBeNull();
    expect(container.textContent).toBe(prose);
  });
});

describe("renderMarkdown — inline", () => {
  it("renders **bold** as <strong>", () => {
    const { container } = renderBody("**important**");
    expect(container.querySelector("strong")).toHaveTextContent("important");
    expect(container.textContent).toBe("important");
  });

  it("renders *italic* as <em>", () => {
    const { container } = renderBody("*whispered*");
    expect(container.querySelector("em")).toHaveTextContent("whispered");
    expect(container.textContent).toBe("whispered");
  });

  it("handles emphasis mid-sentence, keeping the surrounding text", () => {
    const { container } = renderBody("remember the **milk** and some *eggs* too");
    expect(container.querySelector("strong")).toHaveTextContent("milk");
    expect(container.querySelector("em")).toHaveTextContent("eggs");
    expect(container.textContent).toBe("remember the milk and some eggs too");
  });

  it("applies emphasis inside list items", () => {
    const { container } = renderBody("- buy **milk**");
    expect(container.querySelector("li > strong")).toHaveTextContent("milk");
  });

  it("leaves unmatched ** literal", () => {
    const { container } = renderBody("this is **not closed");
    expect(container.querySelector("strong")).toBeNull();
    expect(container.querySelector("em")).toBeNull();
    expect(container.textContent).toBe("this is **not closed");
  });

  it("leaves a lone * literal", () => {
    const { container } = renderBody("2 * 3 = 6");
    expect(container.querySelector("em")).toBeNull();
    expect(container.textContent).toBe("2 * 3 = 6");
  });

  it("renders __bold__ and _italic_ too", () => {
    const { container } = renderBody("__strong__ and _soft_");
    expect(container.querySelector("strong")).toHaveTextContent("strong");
    expect(container.querySelector("em")).toHaveTextContent("soft");
  });

  it("leaves underscores inside words alone", () => {
    // Without word-boundary guards, "some_function_name" would render with an
    // italic "function" — which makes underscore emphasis unusable for anyone
    // writing about code.
    const { container } = renderBody("call some_function_name now");
    expect(container.querySelector("em")).toBeNull();
    expect(container.textContent).toBe("call some_function_name now");
  });

  it("still emphasises underscores at word boundaries", () => {
    // "__init__" surrounded by spaces does become bold. That's CommonMark's
    // behaviour too, and it's the price of supporting "_italic_" at all —
    // the guard above can only protect underscores *inside* a word.
    const { container } = renderBody("the __init__ method");
    expect(container.querySelector("strong")).toHaveTextContent("init");
  });

  it("nests emphasis", () => {
    const { container } = renderBody("**_both_**");
    expect(container.querySelector("strong > em")).toHaveTextContent("both");
  });
});

describe("renderMarkdown — XSS", () => {
  // The whole "React elements, never HTML strings" design exists for this.
  // If someone ever swaps the renderer for string concatenation +
  // dangerouslySetInnerHTML, this is the test that fails.
  it("renders HTML in a note body as visible literal text, creating no elements", () => {
    const hostile = '<script>alert(1)</script>\n<img src=x onerror=alert(1)>';
    const { container } = renderBody(hostile);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("escapes hostile markup inside bullets and emphasis too", () => {
    const { container } = renderBody("- **<img src=x onerror=alert(1)>**");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("li > strong")).toHaveTextContent(
      "<img src=x onerror=alert(1)>"
    );
  });
});
