"use client";

// Re-export Tiptap components under the legacy names so all pages
// (Brain, Meetings, Skills, Memory, Reports) pick up Tiptap automatically.
export { TiptapViewer as MarkdownViewer, TiptapEditor as MarkdownEditor } from "./tiptap-editor";
