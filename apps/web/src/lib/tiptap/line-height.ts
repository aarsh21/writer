import { Extension } from "@tiptap/core"
import type { Node } from "@tiptap/pm/model"
import type { Transaction } from "@tiptap/pm/state"

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		lineHeight: {
			setLineHeight: (lineHeight: string) => ReturnType
			unsetLineHeight: () => ReturnType
		}
	}
}

export const LineHeightExtension = Extension.create({
	name: "lineHeight",
	addOptions() {
		return {
			types: ["paragraph", "heading"],
			defaultLineHeight: "normal",
		}
	},
	addGlobalAttributes() {
		return [
			{
				types: this.options.types,
				attributes: {
					lineHeight: {
						default: this.options.defaultLineHeight,
						renderHTML: (attributes: Record<string, string>) => {
							if (!attributes.lineHeight) return {}
							return {
								style: `line-height: ${attributes.lineHeight}`,
							}
						},
						parseHTML: (element: HTMLElement) => {
							return element.style.lineHeight || this.options.defaultLineHeight
						},
					},
				},
			},
		]
	},
	addCommands() {
		return {
			setLineHeight:
				(lineHeight: string) =>
				({ tr, state, dispatch }) => {
					const { selection } = state
					let transaction: Transaction = tr.setSelection(selection)

					const { from, to } = selection
					state.doc.nodesBetween(from, to, (node: Node, pos: number) => {
						if (this.options.types.includes(node.type.name)) {
							transaction = transaction.setNodeMarkup(pos, undefined, {
								...node.attrs,
								lineHeight,
							})
						}
					})

					if (dispatch) dispatch(transaction)
					return true
				},
			unsetLineHeight:
				() =>
				({ tr, state, dispatch }) => {
					const { selection } = state
					let transaction: Transaction = tr.setSelection(selection)

					const { from, to } = selection
					state.doc.nodesBetween(from, to, (node: Node, pos: number) => {
						if (this.options.types.includes(node.type.name)) {
							transaction = transaction.setNodeMarkup(pos, undefined, {
								...node.attrs,
								lineHeight: this.options.defaultLineHeight,
							})
						}
					})

					if (dispatch) dispatch(transaction)
					return true
				},
		}
	},
})
