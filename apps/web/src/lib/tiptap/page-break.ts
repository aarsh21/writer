import { Node } from "@tiptap/core"
import type { Transaction } from "@tiptap/pm/state"
import { TextSelection } from "@tiptap/pm/state"

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		pageBreak: {
			setPageBreak: () => ReturnType
		}
	}
}

export const PageBreak = Node.create({
	name: "pageBreak",

	group: "block",

	parseHTML() {
		return [{ tag: 'div[data-type="page-break"]' }]
	},

	renderHTML() {
		return ["div", { "data-type": "page-break", class: "page-break" }]
	},

	addCommands() {
		return {
			setPageBreak:
				() =>
				({ chain }) => {
					return chain()
						.insertContent({ type: this.name })
						.command(
							({
								tr,
								dispatch,
							}: {
								tr: Transaction
								dispatch: ((tr: Transaction) => void) | undefined
							}) => {
								if (dispatch) {
									const { $to } = tr.selection
									const posAfter = $to.end()

									if ($to.nodeAfter) {
										tr.setSelection(TextSelection.create(tr.doc, $to.pos))
									} else {
										// Add paragraph after page break if at end of document
										const node = $to.parent.type.contentMatch.defaultType?.create()
										if (node) {
											tr.insert(posAfter, node)
											tr.setSelection(TextSelection.create(tr.doc, posAfter))
										}
									}
									tr.scrollIntoView()
								}
								return true
							},
						)
						.run()
				},
		}
	},

	addKeyboardShortcuts() {
		return {
			"Mod-Enter": () => this.editor.commands.setPageBreak(),
		}
	},
})
