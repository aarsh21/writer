import type { Editor } from "@tiptap/react"
import { create } from "zustand"

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error"

interface EditorState {
	editor: Editor | null
	setEditor: (editor: Editor | null) => void
	saveStatus: SaveStatus
	setSaveStatus: (status: SaveStatus) => void
}

export const useEditorStore = create<EditorState>((set) => ({
	editor: null,
	setEditor: (editor) => set({ editor }),
	saveStatus: "idle",
	setSaveStatus: (saveStatus) => set({ saveStatus }),
}))
