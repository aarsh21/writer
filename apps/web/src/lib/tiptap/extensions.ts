import CharacterCount from "@tiptap/extension-character-count"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import Highlight from "@tiptap/extension-highlight"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import TextAlign from "@tiptap/extension-text-align"
import Typography from "@tiptap/extension-typography"
import Underline from "@tiptap/extension-underline"
import StarterKit from "@tiptap/starter-kit"
import { common, createLowlight } from "lowlight"

// Create lowlight instance with common languages
const lowlight = createLowlight(common)

export const extensions = [
	StarterKit.configure({
		codeBlock: false, // We use CodeBlockLowlight instead
		heading: {
			levels: [1, 2, 3],
		},
	}),
	Underline,
	TextAlign.configure({
		types: ["heading", "paragraph"],
	}),
	Highlight.configure({
		multicolor: true,
	}),
	Link.configure({
		openOnClick: false,
		HTMLAttributes: {
			class: "text-primary underline underline-offset-4 cursor-pointer",
		},
	}),
	Placeholder.configure({
		placeholder: "Start writing...",
		emptyEditorClass:
			"before:content-[attr(data-placeholder)] before:text-muted-foreground before:float-left before:h-0 before:pointer-events-none",
	}),
	CharacterCount,
	CodeBlockLowlight.configure({
		lowlight,
		HTMLAttributes: {
			class: "bg-muted rounded-md p-4 font-mono text-sm",
		},
	}),
	TaskList.configure({
		HTMLAttributes: {
			class: "not-prose pl-2",
		},
	}),
	TaskItem.configure({
		nested: true,
		HTMLAttributes: {
			class: "flex gap-2 items-start",
		},
	}),
	Typography,
]

export { lowlight }
