import { useEditor, EditorContent } from "@tiptap/react"
import { useEffect, useRef, useMemo } from "react"
import { extensions } from "@/lib/tiptap/extensions"
import { cn } from "@/lib/utils"
import { EditorToolbar } from "./editor-toolbar"

interface TiptapEditorProps {
	content?: string
	onUpdate?: (content: string) => void
	editable?: boolean
	className?: string
}

export function TiptapEditor({
	content = "",
	onUpdate,
	editable = true,
	className,
}: TiptapEditorProps) {
	// Track if this is the initial render
	const isInitialMount = useRef(true)
	// Track last content we sent to parent to avoid echo updates
	const lastEmittedContent = useRef<string | null>(null)

	// Parse initial content only once
	const initialContent = useMemo(() => {
		try {
			return content ? JSON.parse(content) : { type: "doc", content: [] }
		} catch {
			return { type: "doc", content: [] }
		}
	}, []) // Empty deps - only parse on initial mount

	const editor = useEditor({
		extensions,
		content: initialContent,
		editable,
		editorProps: {
			attributes: {
				class: cn(
					"prose prose-sm dark:prose-invert max-w-none",
					"focus:outline-none",
					"min-h-[500px] px-8 py-6",
					// Headings
					"prose-headings:font-semibold prose-headings:tracking-tight",
					"prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl",
					// Paragraphs
					"prose-p:leading-7",
					// Links
					"prose-a:text-primary prose-a:underline prose-a:underline-offset-4",
					// Lists
					"prose-ul:my-4 prose-ol:my-4",
					"prose-li:my-0",
					// Code
					"prose-code:bg-muted prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-sm",
					"prose-pre:bg-muted prose-pre:rounded-md prose-pre:p-4",
					// Blockquote
					"prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:italic",
					// HR
					"prose-hr:border-border",
				),
			},
		},
		onUpdate: ({ editor }) => {
			const json = JSON.stringify(editor.getJSON())
			lastEmittedContent.current = json
			onUpdate?.(json)
		},
	})

	// Handle external content updates (from other collaborators or initial load)
	useEffect(() => {
		if (!editor || !content) return

		// Skip initial mount - content is already set via initialContent
		if (isInitialMount.current) {
			isInitialMount.current = false
			return
		}

		// Skip if this is content we just emitted (echo prevention)
		if (content === lastEmittedContent.current) {
			return
		}

		// Only update if editor is not focused (user is not actively typing)
		// This prevents disrupting the user's typing experience
		if (!editor.isFocused) {
			try {
				const parsed = JSON.parse(content)
				editor.commands.setContent(parsed, { emitUpdate: false })
			} catch {
				// Invalid JSON, ignore
			}
		}
	}, [content, editor])

	if (!editor) {
		return null
	}

	return (
		<div className={cn("flex flex-col", className)}>
			<EditorToolbar editor={editor} />
			<div className="bg-card flex-1 overflow-auto">
				<EditorContent editor={editor} />
			</div>
		</div>
	)
}

export { useEditor }
