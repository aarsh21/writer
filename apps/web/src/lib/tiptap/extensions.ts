import CharacterCount from "@tiptap/extension-character-count"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import { Color } from "@tiptap/extension-color"
import FontFamily from "@tiptap/extension-font-family"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { Table } from "@tiptap/extension-table"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { TableRow } from "@tiptap/extension-table-row"
import TaskItem from "@tiptap/extension-task-item"
import TaskList from "@tiptap/extension-task-list"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import Typography from "@tiptap/extension-typography"
import Underline from "@tiptap/extension-underline"
import StarterKit from "@tiptap/starter-kit"
import { common, createLowlight } from "lowlight"

import { FontSizeExtension } from "./font-size"
import { LineHeightExtension } from "./line-height"

// Create lowlight instance with common languages
const lowlight = createLowlight(common)

export const extensions = [
	StarterKit.configure({
		codeBlock: false, // We use CodeBlockLowlight instead
		link: false, // We configure Link separately
		underline: false, // We configure Underline separately
		heading: {
			levels: [1, 2, 3, 4, 5],
		},
		bulletList: {
			keepMarks: true,
			keepAttributes: false,
		},
		orderedList: {
			keepMarks: true,
			keepAttributes: false,
		},
	}),
	Underline,
	FontFamily,
	TextStyle,
	Color,
	TextAlign.configure({
		types: ["heading", "paragraph"],
	}),
	Highlight.configure({
		multicolor: true,
	}),
	Link.configure({
		openOnClick: false,
		autolink: true,
		defaultProtocol: "https",
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
	Image,
	Table,
	TableRow,
	TableHeader,
	TableCell,
	FontSizeExtension,
	LineHeightExtension.configure({
		types: ["heading", "paragraph"],
		defaultLineHeight: "1.5",
	}),
]

export { lowlight }
