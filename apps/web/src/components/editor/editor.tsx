import { EditorContent, useEditor } from "@tiptap/react"
import type { AnyExtension, Content } from "@tiptap/core"
import { useEffect, useRef } from "react"

import { extensions } from "@/lib/tiptap/extensions"
import { cn } from "@/lib/utils"
import { useEditorStore } from "@/store/use-editor-store"

interface EditorProps {
	initialContent?: Content
	syncExtension?: AnyExtension
	onUpdate?: (content: string) => void
	editable?: boolean
}

export const Editor = ({
	initialContent,
	syncExtension,
	onUpdate,
	editable = true,
}: EditorProps) => {
	const { setEditor } = useEditorStore()

	// Track if this is the initial render
	const isInitialMount = useRef(true)
	// Track last content we sent to parent to avoid echo updates
	const lastEmittedContent = useRef<string | null>(null)
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
					editable ? "cursor-text" : "cursor-default",
				),
			},
		},
		extensions: syncExtension ? [...extensions, syncExtension] : extensions,
		content: initialContent ?? { type: "doc", content: [] },
		editable,
	})

	useEffect(() => {
		if (!editor) return
		editor.setEditable(editable)
	}, [editor, editable])

	useEffect(() => {
		if (isInitialMount.current) {
			isInitialMount.current = false
		}
	}, [])

	return (
		<div className="bg-muted flex size-full flex-col overflow-auto px-4 print:overflow-visible print:bg-white print:p-0">
			<div className="mx-auto flex w-[816px] flex-1 flex-col py-4 print:w-full print:py-0">
				<EditorContent editor={editor} className="flex-1" />
			</div>
		</div>
	)
}
