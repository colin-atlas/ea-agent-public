"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useEffect, useRef, useMemo } from "react";
import { marked } from "marked";
import TurndownService from "turndown";

// --- Markdown conversion ---

function mdToHtml(md: string): string {
  if (!md) return "";
  return marked.parse(md, { async: false, gfm: true }) as string;
}

function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  // GFM strikethrough
  td.addRule("strikethrough", {
    filter: ["del", "s"],
    replacement: (content) => `~~${content}~~`,
  });

  // GFM tables
  td.addRule("tableCell", {
    filter: ["th", "td"],
    replacement: (content, node) => {
      return ` ${content.replace(/\n/g, " ").trim()} |`;
    },
  });

  td.addRule("tableRow", {
    filter: "tr",
    replacement: (content, node) => {
      return `|${content}\n`;
    },
  });

  td.addRule("table", {
    filter: "table",
    replacement: (_content, node) => {
      const el = node as HTMLTableElement;
      const rows = Array.from(el.querySelectorAll("tr"));
      if (rows.length === 0) return "";

      const lines: string[] = [];
      rows.forEach((row, i) => {
        const cells = Array.from(row.querySelectorAll("th, td"));
        const cellTexts = cells.map((c) => ` ${c.textContent?.replace(/\n/g, " ").trim() || ""} `);
        lines.push(`|${cellTexts.join("|")}|`);
        if (i === 0) {
          lines.push(`|${cellTexts.map(() => " --- ").join("|")}|`);
        }
      });
      return `\n${lines.join("\n")}\n\n`;
    },
  });

  return td;
}

function htmlToMd(html: string, turndown: TurndownService): string {
  if (!html || html === "<p></p>") return "";
  return turndown.turndown(html);
}

// --- Shared styles ---

const PROSE_CLASSES = `prose prose-invert prose-sm max-w-none
  prose-headings:text-zinc-200
  prose-h1:text-2xl prose-h1:font-bold prose-h1:border-b prose-h1:border-zinc-700 prose-h1:pb-2 prose-h1:mb-4
  prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-6 prose-h2:mb-3
  prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2
  prose-h4:text-base prose-h4:font-semibold
  prose-p:text-zinc-300 prose-p:leading-relaxed
  prose-a:text-[#B675F5] prose-a:no-underline hover:prose-a:underline
  prose-strong:text-zinc-200
  prose-code:text-[#B675F5] prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
  prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700 prose-pre:rounded-md
  prose-blockquote:border-l-[#B675F5]/40 prose-blockquote:text-zinc-400 prose-blockquote:not-italic
  prose-li:text-zinc-300
  prose-th:text-zinc-300 prose-td:text-zinc-400
  prose-hr:border-zinc-700
  [&_.ProseMirror]:outline-none
  [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:w-full
  [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-zinc-700 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-zinc-800 [&_.ProseMirror_th]:text-left
  [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-zinc-700 [&_.ProseMirror_td]:p-2
  [&_.ProseMirror_.is-empty]:before:content-[attr(data-placeholder)] [&_.ProseMirror_.is-empty]:before:text-zinc-600 [&_.ProseMirror_.is-empty]:before:float-left [&_.ProseMirror_.is-empty]:before:pointer-events-none [&_.ProseMirror_.is-empty]:before:h-0
`;

// Shared extensions
function getExtensions(editable: boolean) {
  return [
    StarterKit,
    Table.configure({ resizable: editable }),
    TableRow,
    TableHeader,
    TableCell,
    Image,
    Link.configure({ openOnClick: !editable }),
    ...(editable ? [Placeholder.configure({ placeholder: "Start writing..." })] : []),
  ];
}

// --- Toolbar ---

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        isActive
          ? "bg-[rgba(182,117,245,0.2)] text-[#B675F5]"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
      } ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <div className="w-px bg-zinc-700 mx-1 self-stretch" />;
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-zinc-700 bg-zinc-800/50 rounded-t-md">
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold (Ctrl+B)">
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic (Ctrl+I)">
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough">
        <s>S</s>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive("code")} title="Inline code">
        {"</>"}
      </ToolbarButton>

      <ToolbarSep />

      {([1, 2, 3] as const).map((level) => (
        <ToolbarButton
          key={level}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          isActive={editor.isActive("heading", { level })}
          title={`Heading ${level}`}
        >
          H{level}
        </ToolbarButton>
      ))}

      <ToolbarSep />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet list">
        &bull; List
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered list">
        1. List
      </ToolbarButton>

      <ToolbarSep />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Blockquote">
        &ldquo; Quote
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive("codeBlock")} title="Code block">
        &#123;&#125; Code
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
        &mdash; HR
      </ToolbarButton>

      <ToolbarSep />

      <ToolbarButton
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="Insert table"
      >
        &#9638; Table
      </ToolbarButton>

      <ToolbarSep />

      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
        &#8617;
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Shift+Z)">
        &#8618;
      </ToolbarButton>
    </div>
  );
}

// --- Editor Component ---

interface TiptapEditorProps {
  content: string;
  onChange: (markdown: string) => void;
}

export function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const suppressUpdate = useRef(false);
  const turndown = useMemo(() => createTurndown(), []);

  const editor = useEditor({
    extensions: getExtensions(true),
    content: mdToHtml(content),
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (suppressUpdate.current) return;
      const md = htmlToMd(editor.getHTML(), turndown);
      onChangeRef.current(md);
    },
  });

  // Sync content prop changes (e.g. switching files)
  useEffect(() => {
    if (!editor) return;
    suppressUpdate.current = true;
    editor.commands.setContent(mdToHtml(content));
    suppressUpdate.current = false;
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="tiptap-wrapper rounded-md border border-zinc-700 bg-zinc-900/50">
      <Toolbar editor={editor} />
      <div className={`p-4 min-h-[500px] max-h-[70vh] overflow-auto ${PROSE_CLASSES} [&_.ProseMirror]:min-h-[480px]`}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// --- Viewer Component (read-only Tiptap) ---

interface TiptapViewerProps {
  content: string;
}

export function TiptapViewer({ content }: TiptapViewerProps) {
  const editor = useEditor({
    extensions: getExtensions(false),
    content: mdToHtml(content),
    editable: false,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(mdToHtml(content));
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className={PROSE_CLASSES}>
      <EditorContent editor={editor} />
    </div>
  );
}
