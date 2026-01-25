import type { Level } from "@tiptap/extension-heading"
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	Bold,
	ChevronDown,
	FileText,
	Highlighter,
	ImageIcon,
	Italic,
	Link2,
	List,
	ListCollapse,
	ListOrdered,
	ListTodo,
	type LucideIcon,
	Minus,
	Plus,
	Printer,
	Redo2,
	RemoveFormatting,
	Search,
	SpellCheck,
	Underline,
	Undo2,
	Upload,
} from "lucide-react"
import type React from "react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useEditorStore } from "@/store/use-editor-store"

const LineHeightButton = () => {
	const { editor, canEdit } = useEditorStore()

	const lineHeights = [
		{ label: "Default", value: "normal" },
		{ label: "Single", value: "1" },
		{ label: "1.15", value: "1.15" },
		{ label: "1.5", value: "1.5" },
		{ label: "Double", value: "2" },
	]

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							disabled={!canEdit}
							className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
						>
							<ListCollapse className="size-4" />
						</button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>Line Height</TooltipContent>
			</Tooltip>
			<DropdownMenuContent className="flex flex-col gap-y-1 p-1">
				{lineHeights.map(({ label, value }) => (
					<button
						type="button"
						key={value}
						disabled={!canEdit}
						onClick={() => {
							if (!canEdit) return
							editor?.chain().focus().setLineHeight(value).run()
						}}
						className={cn(
							"hover:bg-accent flex items-center gap-x-2 rounded-sm px-2 py-1",
							editor?.getAttributes("paragraph").lineHeight === value && "bg-accent",
						)}
					>
						<span className="text-sm">{label}</span>
					</button>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

const FontSizeButton = () => {
	const { editor, canEdit } = useEditorStore()

	const currentFontSize = editor?.getAttributes("textStyle").fontSize
		? editor?.getAttributes("textStyle").fontSize.replace("px", "")
		: "16"

	const [fontSize, setFontSize] = useState(currentFontSize)
	const [inputValue, setInputValue] = useState(fontSize)
	const [isEditing, setIsEditing] = useState(false)

	const updateFontSize = (newSize: string) => {
		if (!canEdit) {
			setIsEditing(false)
			return
		}

		const size = Number.parseInt(newSize, 10)
		if (!Number.isNaN(size) && size > 0) {
			editor?.chain().focus().setFontSize(`${size}px`).run()
			setFontSize(newSize)
			setInputValue(newSize)
			setIsEditing(false)
		}
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!canEdit) return
		setInputValue(e.target.value)
	}

	const handleInputBlur = () => {
		updateFontSize(inputValue)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault()
			updateFontSize(inputValue)
			editor?.commands.focus()
		}
	}

	const increment = () => {
		const newSize = Number.parseInt(fontSize, 10) + 1
		updateFontSize(newSize.toString())
	}

	const decrement = () => {
		const newSize = Number.parseInt(fontSize, 10) - 1
		if (newSize > 0) {
			updateFontSize(newSize.toString())
		}
	}

	return (
		<div className="flex items-center gap-x-0.5">
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						disabled={!canEdit}
						onClick={decrement}
						className="hover:bg-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
					>
						<Minus className="size-4" />
					</button>
				</TooltipTrigger>
				<TooltipContent>Decrease Font Size</TooltipContent>
			</Tooltip>
			{isEditing ? (
				<input
					type="text"
					value={inputValue}
					onChange={handleInputChange}
					onBlur={handleInputBlur}
					onKeyDown={handleKeyDown}
					disabled={!canEdit}
					className="border-input h-7 w-10 rounded-sm border bg-transparent text-center text-sm focus:outline-none focus:ring-0"
				/>
			) : (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							disabled={!canEdit}
							onClick={() => {
								if (!canEdit) return
								setIsEditing(true)
								setFontSize(currentFontSize)
							}}
							className="border-input h-7 w-10 cursor-text rounded-sm border bg-transparent text-center text-sm"
						>
							{currentFontSize}
						</button>
					</TooltipTrigger>
					<TooltipContent>Font Size</TooltipContent>
				</Tooltip>
			)}
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						disabled={!canEdit}
						onClick={increment}
						className="hover:bg-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
					>
						<Plus className="size-4" />
					</button>
				</TooltipTrigger>
				<TooltipContent>Increase Font Size</TooltipContent>
			</Tooltip>
		</div>
	)
}

const ListButton = () => {
	const { editor, canEdit } = useEditorStore()

	const lists = [
		{
			label: "Bullet List",
			icon: List,
			isActive: () => editor?.isActive("bulletList"),
			onClick: () => editor?.chain().focus().toggleBulletList().run(),
		},
		{
			label: "Ordered List",
			icon: ListOrdered,
			isActive: () => editor?.isActive("orderedList"),
			onClick: () => editor?.chain().focus().toggleOrderedList().run(),
		},
	]

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							disabled={!canEdit}
							className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
						>
							<List className="size-4" />
						</button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>Lists</TooltipContent>
			</Tooltip>
			<DropdownMenuContent className="flex flex-col gap-y-1 p-1">
				{lists.map(({ label, icon: Icon, onClick, isActive }) => (
					<button
						type="button"
						key={label}
						disabled={!canEdit}
						onClick={() => {
							if (!canEdit) return
							onClick()
						}}
						className={cn(
							"hover:bg-accent flex items-center gap-x-2 rounded-sm px-2 py-1",
							isActive() && "bg-accent",
						)}
					>
						<Icon className="size-4" />
						<span className="text-sm">{label}</span>
					</button>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

const AlignButton = () => {
	const { editor, canEdit } = useEditorStore()

	const alignments = [
		{
			label: "Align Left",
			value: "left",
			icon: AlignLeft,
		},
		{
			label: "Align Center",
			value: "center",
			icon: AlignCenter,
		},
		{
			label: "Align Right",
			value: "right",
			icon: AlignRight,
		},
		{
			label: "Align Justify",
			value: "justify",
			icon: AlignJustify,
		},
	]

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							disabled={!canEdit}
							className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
						>
							<AlignLeft className="size-4" />
						</button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>Text Alignment</TooltipContent>
			</Tooltip>
			<DropdownMenuContent className="flex flex-col gap-y-1 p-1">
				{alignments.map(({ label, value, icon: Icon }) => (
					<button
						type="button"
						key={value}
						disabled={!canEdit}
						onClick={() => {
							if (!canEdit) return
							editor?.chain().focus().setTextAlign(value).run()
						}}
						className={cn(
							"hover:bg-accent flex items-center gap-x-2 rounded-sm px-2 py-1",
							editor?.isActive({ textAlign: value }) && "bg-accent",
						)}
					>
						<Icon className="size-4" />
						<span className="text-sm">{label}</span>
					</button>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

const ImageButton = () => {
	const { editor, canEdit } = useEditorStore()
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [imageUrl, setImageUrl] = useState("")

	const onChange = (src: string) => {
		if (!canEdit) return
		editor?.chain().focus().setImage({ src }).run()
	}

	const onUpload = () => {
		if (!canEdit) return
		const input = document.createElement("input")
		input.type = "file"
		input.accept = "image/*"

		input.onchange = (e) => {
			const file = (e.target as HTMLInputElement).files?.[0]

			if (file) {
				const imageUrl = URL.createObjectURL(file)
				onChange(imageUrl)
			}
		}

		input.click()
	}

	const handleImageUrlSubmit = () => {
		if (!canEdit) return
		if (imageUrl) {
			onChange(imageUrl)
			setImageUrl("")
			setIsDialogOpen(false)
		}
	}

	return (
		<>
			<DropdownMenu>
				<Tooltip>
					<TooltipTrigger asChild>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								disabled={!canEdit}
								className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
							>
								<ImageIcon className="size-4" />
							</button>
						</DropdownMenuTrigger>
					</TooltipTrigger>
					<TooltipContent>Insert Image</TooltipContent>
				</Tooltip>
				<DropdownMenuContent className="flex flex-col gap-x-2 p-2.5">
					<DropdownMenuItem disabled={!canEdit} onClick={onUpload} className="cursor-pointer">
						<Upload className="mr-2 size-4" />
						Upload
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={!canEdit}
						onClick={() => {
							if (!canEdit) return
							setIsDialogOpen(true)
						}}
						className="cursor-pointer"
					>
						<Search className="mr-2 size-4" />
						Paste image url
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog
				open={isDialogOpen}
				onOpenChange={(open) => {
					if (!canEdit) return
					setIsDialogOpen(open)
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Insert image URL</DialogTitle>
					</DialogHeader>
					<Input
						placeholder="Insert image URL"
						value={imageUrl}
						disabled={!canEdit}
						onChange={(e) => setImageUrl(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleImageUrlSubmit()
							}
						}}
					/>
					<DialogFooter>
						<Button disabled={!canEdit} onClick={handleImageUrlSubmit}>
							Insert
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

const LinkButton = () => {
	const { editor, canEdit } = useEditorStore()
	const [value, setValue] = useState("")

	const onChange = (href: string) => {
		if (!canEdit) return
		editor?.chain().focus().extendMarkRange("link").setLink({ href }).run()
		setValue("")
	}

	return (
		<DropdownMenu
			onOpenChange={(open) => {
				if (!canEdit) return
				if (open) {
					setValue(editor?.getAttributes("link").href || "")
				}
			}}
		>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							disabled={!canEdit}
							className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
						>
							<Link2 className="size-4" />
						</button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>Insert Link</TooltipContent>
			</Tooltip>
			<DropdownMenuContent className="flex items-center gap-x-2 p-2.5">
				<Input
					placeholder="https://www.example.com"
					value={value}
					disabled={!canEdit}
					onChange={(e) => {
						if (!canEdit) return
						setValue(e.target.value)
					}}
				/>
				<Button disabled={!canEdit} onClick={() => onChange(value)}>
					Apply
				</Button>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

const HighlightColorButton = () => {
	const { editor, canEdit } = useEditorStore()

	const value = editor?.getAttributes("highlight").color || "#FFFFFF"

	const onChange = (color: string) => {
		if (!canEdit) return
		editor?.chain().focus().setHighlight({ color }).run()
	}

	const colors = [
		"#FFFFFF",
		"#FFFF00",
		"#00FF00",
		"#00FFFF",
		"#FF00FF",
		"#FF0000",
		"#0000FF",
		"#FFA500",
	]

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							disabled={!canEdit}
							className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
						>
							<Highlighter className="size-4" />
						</button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>Highlight Color</TooltipContent>
			</Tooltip>
			<DropdownMenuContent className="border-0 p-2">
				<div className="grid grid-cols-4 gap-1">
					{colors.map((color) => (
						<button
							type="button"
							key={color}
							disabled={!canEdit}
							onClick={() => onChange(color)}
							className={cn(
								"h-6 w-6 rounded border",
								value === color && "ring-primary ring-2 ring-offset-2",
							)}
							style={{ backgroundColor: color }}
						/>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

const TextColorButton = () => {
	const { editor, canEdit } = useEditorStore()

	const value = editor?.getAttributes("textStyle").color || "#000000"

	const onChange = (color: string) => {
		if (!canEdit) return
		editor?.chain().focus().setColor(color).run()
	}

	const colors = [
		"#000000",
		"#434343",
		"#666666",
		"#999999",
		"#FF0000",
		"#FF9900",
		"#FFFF00",
		"#00FF00",
		"#00FFFF",
		"#0000FF",
		"#9900FF",
		"#FF00FF",
	]

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							disabled={!canEdit}
							className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
						>
							<span className="text-xs">A</span>
							<div className="h-0.5 w-full" style={{ backgroundColor: value }}></div>
						</button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>Text Color</TooltipContent>
			</Tooltip>
			<DropdownMenuContent className="border-0 p-2">
				<div className="grid grid-cols-4 gap-1">
					{colors.map((color) => (
						<button
							type="button"
							key={color}
							disabled={!canEdit}
							onClick={() => onChange(color)}
							className={cn(
								"h-6 w-6 rounded border",
								value === color && "ring-primary ring-2 ring-offset-2",
							)}
							style={{ backgroundColor: color }}
						/>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

const HeadingLevelButton = () => {
	const { editor, canEdit } = useEditorStore()

	const headings = [
		{ label: "Normal text", value: 0, fontSize: "16px" },
		{ label: "Heading 1", value: 1, fontSize: "32px" },
		{ label: "Heading 2", value: 2, fontSize: "24px" },
		{ label: "Heading 3", value: 3, fontSize: "20px" },
		{ label: "Heading 4", value: 4, fontSize: "18px" },
		{ label: "Heading 5", value: 5, fontSize: "16px" },
	]

	const getCurrentHeading = () => {
		for (let level = 1; level <= 5; level++) {
			if (editor?.isActive("heading", { level })) {
				return `Heading ${level}`
			}
		}

		return "Normal text"
	}

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							disabled={!canEdit}
							className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
						>
							<span className="truncate">{getCurrentHeading()}</span>
							<ChevronDown className="ml-2 size-4 shrink-0" />
						</button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>Heading Level</TooltipContent>
			</Tooltip>
			<DropdownMenuContent className="flex flex-col gap-y-1 p-1">
				{headings.map(({ label, value, fontSize }) => (
					<button
						type="button"
						key={value}
						disabled={!canEdit}
						style={{ fontSize }}
						className={cn(
							"hover:bg-accent flex items-center gap-x-2 rounded-sm px-2 py-1",
							(value === 0 && !editor?.isActive("heading")) ||
								(editor?.isActive("heading", { level: value as Level }) && "bg-accent"),
						)}
						onClick={() => {
							if (!canEdit) return
							if (value === 0) {
								editor?.chain().focus().setParagraph().run()
								return
							}
							editor
								?.chain()
								.focus()
								.toggleHeading({ level: value as Level })
								.run()
						}}
					>
						{label}
					</button>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

const FontFamilyButton = () => {
	const { editor, canEdit } = useEditorStore()

	const fonts = [
		{ label: "Arial", value: "Arial" },
		{ label: "Times New Roman", value: "Times New Roman" },
		{ label: "Courier New", value: "Courier New" },
		{ label: "Georgia", value: "Georgia" },
		{ label: "Verdana", value: "Verdana" },
	]

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							disabled={!canEdit}
							className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
						>
							<span className="truncate">
								{editor?.getAttributes("textStyle").fontFamily || "Arial"}
							</span>
							<ChevronDown className="ml-2 size-4 shrink-0" />
						</button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>Font Family</TooltipContent>
			</Tooltip>
			<DropdownMenuContent className="flex flex-col gap-y-1 p-1">
				{fonts.map(({ label, value }) => (
					<button
						type="button"
						disabled={!canEdit}
						onClick={() => {
							if (!canEdit) return
							editor?.chain().focus().setFontFamily(value).run()
						}}
						key={value}
						className={cn(
							"hover:bg-accent flex items-center gap-x-2 rounded-sm px-2 py-1",
							editor?.getAttributes("textStyle").fontFamily === value && "bg-accent",
						)}
						style={{ fontFamily: value }}
					>
						<span className="text-sm">{label}</span>
					</button>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

interface ToolbarButtonProps {
	onClick?: () => void
	isActive?: boolean
	disabled?: boolean
	icon: LucideIcon
	label: string
	shortcut?: string
}

const ToolbarButton = ({
	onClick,
	isActive,
	disabled,
	icon: Icon,
	label,
	shortcut,
}: ToolbarButtonProps) => {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					disabled={disabled}
					onClick={onClick}
					className={cn(
						"hover:bg-accent flex h-7 min-w-7 items-center justify-center rounded-sm text-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
						isActive && "bg-accent",
					)}
				>
					<Icon className="size-4" />
				</button>
			</TooltipTrigger>
			<TooltipContent className="flex items-center gap-2">
				<span>{label}</span>
				{shortcut && (
					<kbd className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">
						{shortcut}
					</kbd>
				)}
			</TooltipContent>
		</Tooltip>
	)
}

export const Toolbar = () => {
	const { editor, canEdit } = useEditorStore()

	const sections: {
		label: string
		icon: LucideIcon
		onClick: () => void
		isActive?: boolean
		disabled?: boolean
		shortcut?: string
	}[][] = [
		[
			{
				label: "Undo",
				icon: Undo2,
				disabled: !canEdit,
				onClick: () => {
					if (!canEdit) return
					editor?.chain().focus().undo().run()
				},
				shortcut: "⌘Z",
			},
			{
				label: "Redo",
				icon: Redo2,
				disabled: !canEdit,
				onClick: () => {
					if (!canEdit) return
					editor?.chain().focus().redo().run()
				},
				shortcut: "⌘⇧Z",
			},
			{
				label: "Print",
				icon: Printer,
				onClick: () => window.print(),
				shortcut: "⌘P",
			},
			{
				label: "Spell Check",
				icon: SpellCheck,
				onClick: () => {
					const current = editor?.view.dom.getAttribute("spellcheck")
					editor?.view.dom.setAttribute("spellcheck", current === "false" ? "true" : "false")
				},
			},
		],
		[
			{
				label: "Bold",
				icon: Bold,
				disabled: !canEdit,
				isActive: editor?.isActive("bold"),
				onClick: () => {
					if (!canEdit) return
					editor?.chain().focus().toggleBold().run()
				},
				shortcut: "⌘B",
			},
			{
				label: "Italic",
				icon: Italic,
				disabled: !canEdit,
				isActive: editor?.isActive("italic"),
				onClick: () => {
					if (!canEdit) return
					editor?.chain().focus().toggleItalic().run()
				},
				shortcut: "⌘I",
			},
			{
				label: "Underline",
				icon: Underline,
				disabled: !canEdit,
				isActive: editor?.isActive("underline"),
				onClick: () => {
					if (!canEdit) return
					editor?.chain().focus().toggleUnderline().run()
				},
				shortcut: "⌘U",
			},
		],
		[
			{
				label: "Task List",
				icon: ListTodo,
				disabled: !canEdit,
				onClick: () => {
					if (!canEdit) return
					editor?.chain().focus().toggleTaskList().run()
				},
				isActive: editor?.isActive("taskList"),
			},
			{
				label: "Remove Formatting",
				icon: RemoveFormatting,
				disabled: !canEdit,
				onClick: () => {
					if (!canEdit) return
					editor?.chain().focus().unsetAllMarks().run()
				},
				shortcut: "⌘\\",
			},
		],
		[
			{
				label: "Insert Page Break",
				icon: FileText,
				disabled: !canEdit,
				onClick: () => {
					if (!canEdit) return
					editor?.commands.setPageBreak()
				},
				shortcut: "⌘↵",
			},
		],
	]

	return (
		<div className="border-border bg-background flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
			{sections[0].map((item) => (
				<ToolbarButton key={item.label} {...item} />
			))}
			<Separator orientation="vertical" className="mx-1 h-6" />
			<FontFamilyButton />
			<Separator orientation="vertical" className="mx-1 h-6" />
			<HeadingLevelButton />
			<Separator orientation="vertical" className="mx-1 h-6" />
			<FontSizeButton />
			<Separator orientation="vertical" className="mx-1 h-6" />
			{sections[1].map((item) => (
				<ToolbarButton key={item.label} {...item} />
			))}
			<TextColorButton />
			<HighlightColorButton />
			<Separator orientation="vertical" className="mx-1 h-6" />
			<LinkButton />
			<ImageButton />
			<AlignButton />
			<LineHeightButton />
			<ListButton />
			{sections[2].map((item) => (
				<ToolbarButton key={item.label} {...item} />
			))}
			<Separator orientation="vertical" className="mx-1 h-6" />
			{sections[3].map((item) => (
				<ToolbarButton key={item.label} {...item} />
			))}
		</div>
	)
}
