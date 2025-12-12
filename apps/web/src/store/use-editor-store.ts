import type { Editor } from "@tiptap/react"
import { create } from "zustand"

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error"

interface EditorState {
	editor: Editor | null
	setEditor: (editor: Editor | null) => void
	canEdit: boolean
	setCanEdit: (canEdit: boolean) => void
	saveStatus: SaveStatus
	setSaveStatus: (status: SaveStatus) => void
}

export const useEditorStore = create<EditorState>((set) => ({
	editor: null,
	setEditor: (editor) => set({ editor }),
	canEdit: false,
	setCanEdit: (canEdit) => set({ canEdit }),
	saveStatus: "idle",
	setSaveStatus: (saveStatus) => set({ saveStatus }),
}))
