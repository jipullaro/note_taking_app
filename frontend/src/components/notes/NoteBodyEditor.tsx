"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

import { docToMarkdown, markdownToDoc } from "@/lib/tiptap-markdown";

/**
 * The note body: a rich-text editor that styles markdown as you type.
 *
 * A <textarea> renders one uniform run of text and cannot style its own
 * contents, so any "see the formatting while typing" behaviour needs a
 * contenteditable surface. Tiptap (ProseMirror) supplies that plus the input
 * rules that do the actual work: "- " opens a bullet, "**x**" turns bold the
 * moment the closing marker is typed, "_x_" turns italic. The markers are
 * consumed as they fire, so what's left on screen is the formatted text.
 *
 * The value crossing this boundary is still markdown — see lib/tiptap-markdown.
 */
export function NoteBodyEditor({
  value,
  onChange,
  className,
}: {
  /** Markdown. Only read when the editor mounts; see the note on `value` below. */
  value: string;
  onChange: (markdown: string) => void;
  className?: string;
}) {
  const editor = useEditor({
    // Next renders this on the server first; without the flag Tiptap warns
    // about the hydration mismatch its contenteditable inevitably causes.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Only the three marks the card previews and the markdown grammar
        // support. Enabling more here would let the editor produce documents
        // that serialise to markdown the previews then render as literal text.
        heading: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        strike: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: "Pour your heart out…" }),
    ],
    content: markdownToDoc(value),
    editorProps: {
      attributes: {
        // ProseMirror puts role="textbox" on this itself; the label is ours.
        "aria-label": "Note body",
        class: "outline-none min-h-[50vh] flex-1",
      },
    },
    onUpdate: ({ editor }) => onChange(docToMarkdown(editor.getJSON())),
  });

  // `value` is deliberately not synced back into the editor on every render:
  // the editor owns the text while it's mounted, and pushing state back in
  // would fight the caret. This only matters if the note is swapped underneath
  // us (navigating between notes), which remounts via the `key` in NoteEditor.
  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  return <EditorContent editor={editor} className={className} />;
}
