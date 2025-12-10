import { EditorContent, useEditor } from "@tiptap/react"
import { useEffect, useMemo, useRef } from "react"

import { extensions } from "@/lib/tiptap/extensions"
import { cn } from "@/lib/utils"
import { useEditorStore } from "@/store/use-editor-store"

interface EditorProps {
	initialContent?: string
	onUpdate?: (content: string) => void
	editable?: boolean
}

export const Editor = ({ initialContent, onUpdate, editable = true }: EditorProps) => {
	const { setEditor } = useEditorStore()

	// Track if this is the initial render
	const isInitialMount = useRef(true)
	// Track last content we sent to parent to avoid echo updates
	const lastEmittedContent = useRef<string | null>(null)
	// Capture initial content for memoization
	const initialContentRef = useRef(initialContent)

	// Parse initial content only once
	const parsedInitialContent = useMemo(() => {
		try {
			return initialContentRef.current
				? JSON.parse(initialContentRef.current)
				: { type: "doc", content: [] }
		} catch {
			return { type: "doc", content: [] }
		}
	}, [])

	const editor = useEditor({
		immediatelyRender: false,
		onCreate({ editor }) {
			setEditor(editor)
		},
		onDestroy() {
			setEditor(null)
		},
		onUpdate({ editor }) {
			setEditor(editor)
			const json = JSON.stringify(editor.getJSON())
			lastEmittedContent.current = json
			onUpdate?.(json)
		},
		onSelectionUpdate({ editor }) {
			setEditor(editor)
		},
		onTransaction({ editor }) {
			setEditor(editor)
		},
		onFocus({ editor }) {
			setEditor(editor)
		},
		onBlur({ editor }) {
			setEditor(editor)
		},
		onContentError({ editor }) {
			setEditor(editor)
		},
		editorProps: {
			attributes: {
				class: cn(
					"focus:outline-none print:border-0",
					"bg-card border-border border",
					"flex flex-col min-h-full w-[816px]",
					"pt-10 pr-14 pb-10 pl-14",
					"cursor-text",
				),
			},
		},
		extensions,
		content: parsedInitialContent,
		editable,
	})

	// Handle external content updates (from other collaborators or initial load)
	useEffect(() => {
		if (!editor || !initialContent) return

		// Skip initial mount - content is already set via initialContent
		if (isInitialMount.current) {
			isInitialMount.current = false
			return
		}

		// Skip if this is content we just emitted (echo prevention)
		if (initialContent === lastEmittedContent.current) {
			return
		}

		// Only update if editor is not focused (user is not actively typing)
		// This prevents disrupting the user's typing experience
		if (!editor.isFocused) {
			try {
				const parsed = JSON.parse(initialContent)
				editor.commands.setContent(parsed, { emitUpdate: false })
			} catch {
				// Invalid JSON, ignore
			}
		}
	}, [initialContent, editor])

	return (
		<div className="bg-muted flex size-full flex-col overflow-auto px-4 print:overflow-visible print:bg-white print:p-0">
			<div className="mx-auto flex w-[816px] flex-1 flex-col py-4 print:w-full print:py-0">
				<EditorContent editor={editor} className="flex-1" />
			</div>
		</div>
	)
}
