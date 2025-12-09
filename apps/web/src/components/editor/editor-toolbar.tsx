import type { Editor } from "@tiptap/react"
import { Toggle } from "@/components/ui/toggle"
import { Separator } from "@/components/ui/separator"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import {
	Bold,
	Italic,
	Underline,
	Strikethrough,
	Code,
	List,
	ListOrdered,
	ListTodo,
	Quote,
	Undo,
	Redo,
	AlignLeft,
	AlignCenter,
	AlignRight,
	Highlighter,
	Link,
	Minus,
} from "lucide-react"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

interface EditorToolbarProps {
	editor: Editor
}

interface ToolbarButtonProps {
	onClick: () => void
	isActive?: boolean
	disabled?: boolean
	tooltip: string
	shortcut?: string
	children: React.ReactNode
}

function ToolbarButton({
	onClick,
	isActive,
	disabled,
	tooltip,
	shortcut,
	children,
}: ToolbarButtonProps) {
	return (
		<TooltipProvider delayDuration={300}>
			<Tooltip>
				<TooltipTrigger asChild>
					<Toggle
						size="sm"
						pressed={isActive}
						onPressedChange={() => onClick()}
						disabled={disabled}
						className="data-[state=on]:bg-accent h-8 w-8 p-0"
					>
						{children}
					</Toggle>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="flex items-center gap-2">
					<span>{tooltip}</span>
					{shortcut && <Kbd>{shortcut}</Kbd>}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
	const currentLevel = editor.isActive("heading", { level: 1 })
		? "1"
		: editor.isActive("heading", { level: 2 })
			? "2"
			: editor.isActive("heading", { level: 3 })
				? "3"
				: "paragraph"

	return (
		<div className="border-border bg-background flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
			{/* Undo/Redo */}
			<ToolbarButton
				onClick={() => editor.chain().focus().undo().run()}
				disabled={!editor.can().undo()}
				tooltip="Undo"
				shortcut="Ctrl+Z"
			>
				<Undo className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().redo().run()}
				disabled={!editor.can().redo()}
				tooltip="Redo"
				shortcut="Ctrl+Y"
			>
				<Redo className="h-4 w-4" />
			</ToolbarButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* Heading Select */}
			<Select
				value={currentLevel}
				onValueChange={(value) => {
					if (value === "paragraph") {
						editor.chain().focus().setParagraph().run()
					} else {
						editor
							.chain()
							.focus()
							.toggleHeading({ level: parseInt(value) as 1 | 2 | 3 })
							.run()
					}
				}}
			>
				<SelectTrigger className="h-8 w-[130px]">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="paragraph">Paragraph</SelectItem>
					<SelectItem value="1">Heading 1</SelectItem>
					<SelectItem value="2">Heading 2</SelectItem>
					<SelectItem value="3">Heading 3</SelectItem>
				</SelectContent>
			</Select>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* Text Formatting */}
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleBold().run()}
				isActive={editor.isActive("bold")}
				tooltip="Bold"
				shortcut="Ctrl+B"
			>
				<Bold className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleItalic().run()}
				isActive={editor.isActive("italic")}
				tooltip="Italic"
				shortcut="Ctrl+I"
			>
				<Italic className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleUnderline().run()}
				isActive={editor.isActive("underline")}
				tooltip="Underline"
				shortcut="Ctrl+U"
			>
				<Underline className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleStrike().run()}
				isActive={editor.isActive("strike")}
				tooltip="Strikethrough"
				shortcut="Ctrl+Shift+S"
			>
				<Strikethrough className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleCode().run()}
				isActive={editor.isActive("code")}
				tooltip="Inline Code"
				shortcut="Ctrl+E"
			>
				<Code className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleHighlight().run()}
				isActive={editor.isActive("highlight")}
				tooltip="Highlight"
			>
				<Highlighter className="h-4 w-4" />
			</ToolbarButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* Text Alignment */}
			<ToolbarButton
				onClick={() => editor.chain().focus().setTextAlign("left").run()}
				isActive={editor.isActive({ textAlign: "left" })}
				tooltip="Align Left"
			>
				<AlignLeft className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().setTextAlign("center").run()}
				isActive={editor.isActive({ textAlign: "center" })}
				tooltip="Align Center"
			>
				<AlignCenter className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().setTextAlign("right").run()}
				isActive={editor.isActive({ textAlign: "right" })}
				tooltip="Align Right"
			>
				<AlignRight className="h-4 w-4" />
			</ToolbarButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* Lists */}
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleBulletList().run()}
				isActive={editor.isActive("bulletList")}
				tooltip="Bullet List"
			>
				<List className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleOrderedList().run()}
				isActive={editor.isActive("orderedList")}
				tooltip="Numbered List"
			>
				<ListOrdered className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleTaskList().run()}
				isActive={editor.isActive("taskList")}
				tooltip="Task List"
			>
				<ListTodo className="h-4 w-4" />
			</ToolbarButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* Block Elements */}
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
				isActive={editor.isActive("blockquote")}
				tooltip="Blockquote"
			>
				<Quote className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().setHorizontalRule().run()}
				tooltip="Horizontal Rule"
			>
				<Minus className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleCodeBlock().run()}
				isActive={editor.isActive("codeBlock")}
				tooltip="Code Block"
			>
				<Code className="h-4 w-4" />
			</ToolbarButton>
		</div>
	)
}
