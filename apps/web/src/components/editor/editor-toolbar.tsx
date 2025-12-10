import type { Editor } from "@tiptap/react"
import type { Level } from "@tiptap/extension-heading"
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
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	Bold,
	ChevronDown,
	Code,
	Highlighter,
	ImageIcon,
	Italic,
	Link2,
	List,
	ListCollapse,
	ListOrdered,
	ListTodo,
	Minus,
	Plus,
	PrinterIcon,
	Quote,
	Redo,
	RemoveFormatting,
	Search,
	SpellCheck,
	Strikethrough,
	Underline,
	Undo,
	Upload,
} from "lucide-react"

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
						className="data-[state=on]:bg-accent h-7 w-7 p-0"
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

function FontFamilyButton({ editor }: { editor: Editor }) {
	const fonts = [
		{ label: "Arial", value: "Arial" },
		{ label: "Times New Roman", value: "Times New Roman" },
		{ label: "Courier New", value: "Courier New" },
		{ label: "Georgia", value: "Georgia" },
		{ label: "Verdana", value: "Verdana" },
	]

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="border-input bg-background hover:bg-accent hover:text-accent-foreground flex h-7 w-[120px] shrink-0 items-center justify-between overflow-hidden rounded-sm border px-1.5 text-sm"
				>
					<span className="truncate">
						{editor?.getAttributes("textStyle").fontFamily || "Arial"}
					</span>
					<ChevronDown className="ml-2 size-4 shrink-0" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="flex flex-col gap-y-1 p-1">
				{fonts.map(({ label, value }) => (
					<DropdownMenuItem
						key={value}
						onClick={() => editor?.chain().focus().setFontFamily(value).run()}
						className={cn(
							"cursor-pointer",
							editor?.getAttributes("textStyle").fontFamily === value && "bg-accent",
						)}
						style={{ fontFamily: value }}
					>
						{label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function HeadingLevelButton({ editor }: { editor: Editor }) {
	const headings = [
		{ label: "Normal text", value: 0, fontSize: "14px" },
		{ label: "Heading 1", value: 1, fontSize: "28px" },
		{ label: "Heading 2", value: 2, fontSize: "22px" },
		{ label: "Heading 3", value: 3, fontSize: "18px" },
		{ label: "Heading 4", value: 4, fontSize: "16px" },
		{ label: "Heading 5", value: 5, fontSize: "14px" },
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
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="border-input bg-background hover:bg-accent hover:text-accent-foreground flex h-7 min-w-[100px] shrink-0 items-center justify-between overflow-hidden rounded-sm border px-1.5 text-sm"
				>
					<span className="truncate">{getCurrentHeading()}</span>
					<ChevronDown className="ml-2 size-4 shrink-0" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="flex flex-col gap-y-1 p-1">
				{headings.map(({ label, value, fontSize }) => (
					<DropdownMenuItem
						key={value}
						style={{ fontSize }}
						className={cn(
							"cursor-pointer",
							(value === 0 && !editor?.isActive("heading")) ||
								(editor?.isActive("heading", { level: value as Level }) && "bg-accent"),
						)}
						onClick={() => {
							if (value === 0) {
								editor?.chain().focus().setParagraph().run()
							} else {
								editor
									?.chain()
									.focus()
									.toggleHeading({ level: value as Level })
									.run()
							}
						}}
					>
						{label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function FontSizeButton({ editor }: { editor: Editor }) {
	const currentFontSize = editor?.getAttributes("textStyle").fontSize
		? editor?.getAttributes("textStyle").fontSize.replace("px", "")
		: "16"

	const [fontSize, setFontSize] = useState(currentFontSize)
	const [inputValue, setInputValue] = useState(fontSize)
	const [isEditing, setIsEditing] = useState(false)

	const updateFontSize = (newSize: string) => {
		const size = Number.parseInt(newSize, 10)
		if (!Number.isNaN(size) && size > 0) {
			editor?.chain().focus().setFontSize(`${size}px`).run()
			setFontSize(newSize)
			setInputValue(newSize)
			setIsEditing(false)
		}
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
			<button
				type="button"
				onClick={decrement}
				className="hover:bg-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
			>
				<Minus className="size-4" />
			</button>
			{isEditing ? (
				<input
					type="text"
					value={inputValue}
					onChange={handleInputChange}
					onBlur={handleInputBlur}
					onKeyDown={handleKeyDown}
					className="border-input h-7 w-10 rounded-sm border bg-transparent text-center text-sm focus:outline-none focus:ring-0"
				/>
			) : (
				<button
					type="button"
					onClick={() => {
						setIsEditing(true)
						setFontSize(currentFontSize)
					}}
					className="border-input h-7 w-10 cursor-text rounded-sm border bg-transparent text-center text-sm"
				>
					{currentFontSize}
				</button>
			)}
			<button
				type="button"
				onClick={increment}
				className="hover:bg-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
			>
				<Plus className="size-4" />
			</button>
		</div>
	)
}

function TextColorButton({ editor }: { editor: Editor }) {
	const value = editor?.getAttributes("textStyle").color || "#000000"
	const [color, setColor] = useState(value)

	const onChange = (newColor: string) => {
		editor?.chain().focus().setColor(newColor).run()
		setColor(newColor)
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
				>
					<span className="text-xs font-bold">A</span>
					<div className="h-0.5 w-full" style={{ backgroundColor: value }}></div>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="p-2">
				<div className="flex flex-col gap-2">
					<Input
						type="color"
						value={color}
						onChange={(e) => onChange(e.target.value)}
						className="h-8 w-full cursor-pointer"
					/>
					<div className="grid grid-cols-8 gap-1">
						{[
							"#000000",
							"#434343",
							"#666666",
							"#999999",
							"#b7b7b7",
							"#cccccc",
							"#d9d9d9",
							"#ffffff",
							"#980000",
							"#ff0000",
							"#ff9900",
							"#ffff00",
							"#00ff00",
							"#00ffff",
							"#4a86e8",
							"#0000ff",
							"#9900ff",
							"#ff00ff",
							"#e6b8af",
							"#f4cccc",
							"#fce5cd",
							"#fff2cc",
							"#d9ead3",
							"#d0e0e3",
						].map((c) => (
							<button
								type="button"
								key={c}
								onClick={() => onChange(c)}
								className="h-5 w-5 rounded border"
								style={{ backgroundColor: c }}
							/>
						))}
					</div>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function HighlightColorButton({ editor }: { editor: Editor }) {
	const value = editor?.getAttributes("highlight").color || "#FFFF00"
	const [color, setColor] = useState(value)

	const onChange = (newColor: string) => {
		editor?.chain().focus().setHighlight({ color: newColor }).run()
		setColor(newColor)
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
				>
					<Highlighter className="size-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="p-2">
				<div className="flex flex-col gap-2">
					<Input
						type="color"
						value={color}
						onChange={(e) => onChange(e.target.value)}
						className="h-8 w-full cursor-pointer"
					/>
					<div className="grid grid-cols-8 gap-1">
						{[
							"#FFFF00",
							"#00FF00",
							"#00FFFF",
							"#FF00FF",
							"#FF0000",
							"#0000FF",
							"#FFA500",
							"#FFB6C1",
							"#fce5cd",
							"#fff2cc",
							"#d9ead3",
							"#d0e0e3",
							"#cfe2f3",
							"#d9d2e9",
							"#ead1dc",
							"#f4cccc",
						].map((c) => (
							<button
								type="button"
								key={c}
								onClick={() => onChange(c)}
								className="h-5 w-5 rounded border"
								style={{ backgroundColor: c }}
							/>
						))}
					</div>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function LinkButton({ editor }: { editor: Editor }) {
	const [value, setValue] = useState("")

	const onChange = (href: string) => {
		editor?.chain().focus().extendMarkRange("link").setLink({ href }).run()
		setValue("")
	}

	return (
		<DropdownMenu
			onOpenChange={(open) => {
				if (open) {
					setValue(editor?.getAttributes("link").href || "")
				}
			}}
		>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
				>
					<Link2 className="size-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="flex items-center gap-x-2 p-2.5">
				<Input
					placeholder="https://www.example.com"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault()
							onChange(value)
						}
					}}
				/>
				<Button size="sm" onClick={() => onChange(value)}>
					Apply
				</Button>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function ImageButton({ editor }: { editor: Editor }) {
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const [imageUrl, setImageUrl] = useState("")

	const onChange = (src: string) => {
		editor?.chain().focus().setImage({ src }).run()
	}

	const onUpload = () => {
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
		if (imageUrl) {
			onChange(imageUrl)
			setImageUrl("")
			setIsDialogOpen(false)
		}
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="hover:bg-accent flex h-7 min-w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
					>
						<ImageIcon className="size-4" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent className="flex flex-col gap-x-2 p-2.5">
					<DropdownMenuItem onClick={onUpload} className="cursor-pointer">
						<Upload className="mr-2 size-4" />
						Upload
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setIsDialogOpen(true)} className="cursor-pointer">
						<Search className="mr-2 size-4" />
						Paste image URL
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Insert image URL</DialogTitle>
					</DialogHeader>
					<Input
						placeholder="Insert image URL"
						value={imageUrl}
						onChange={(e) => setImageUrl(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleImageUrlSubmit()
							}
						}}
					/>
					<DialogFooter>
						<Button onClick={handleImageUrlSubmit}>Insert</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

function AlignButton({ editor }: { editor: Editor }) {
	const alignments = [
		{ label: "Align Left", value: "left", icon: AlignLeft },
		{ label: "Align Center", value: "center", icon: AlignCenter },
		{ label: "Align Right", value: "right", icon: AlignRight },
		{ label: "Align Justify", value: "justify", icon: AlignJustify },
	]

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
				>
					<AlignLeft className="size-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="flex flex-col gap-y-1 p-1">
				{alignments.map(({ label, value, icon: Icon }) => (
					<DropdownMenuItem
						key={value}
						onClick={() => editor?.chain().focus().setTextAlign(value).run()}
						className={cn("cursor-pointer", editor?.isActive({ textAlign: value }) && "bg-accent")}
					>
						<Icon className="mr-2 size-4" />
						{label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function ListButton({ editor }: { editor: Editor }) {
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
		{
			label: "Task List",
			icon: ListTodo,
			isActive: () => editor?.isActive("taskList"),
			onClick: () => editor?.chain().focus().toggleTaskList().run(),
		},
	]

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
				>
					<List className="size-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="flex flex-col gap-y-1 p-1">
				{lists.map(({ label, icon: Icon, onClick, isActive }) => (
					<DropdownMenuItem
						key={label}
						onClick={onClick}
						className={cn("cursor-pointer", isActive() && "bg-accent")}
					>
						<Icon className="mr-2 size-4" />
						{label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function LineHeightButton({ editor }: { editor: Editor }) {
	const lineHeights = [
		{ label: "Default", value: "normal" },
		{ label: "Single", value: "1" },
		{ label: "1.15", value: "1.15" },
		{ label: "1.5", value: "1.5" },
		{ label: "Double", value: "2" },
	]

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="hover:bg-accent flex h-7 min-w-7 shrink-0 flex-col items-center justify-center overflow-hidden rounded-sm px-1.5 text-sm"
				>
					<ListCollapse className="size-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="flex flex-col gap-y-1 p-1">
				{lineHeights.map(({ label, value }) => (
					<DropdownMenuItem
						key={value}
						onClick={() => editor?.chain().focus().setLineHeight(value).run()}
						className={cn(
							"cursor-pointer",
							editor?.getAttributes("paragraph").lineHeight === value && "bg-accent",
						)}
					>
						{label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
	return (
		<div className="bg-muted/50 flex flex-wrap items-center gap-0.5 rounded-lg px-2.5 py-1">
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
			<ToolbarButton onClick={() => window.print()} tooltip="Print" shortcut="Ctrl+P">
				<PrinterIcon className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => {
					const current = editor?.view.dom.getAttribute("spellcheck")
					editor?.view.dom.setAttribute("spellcheck", current === "false" ? "true" : "false")
				}}
				tooltip="Spell Check"
			>
				<SpellCheck className="h-4 w-4" />
			</ToolbarButton>

			<Separator orientation="vertical" className="bg-border mx-1 h-6" />

			{/* Font Family */}
			<FontFamilyButton editor={editor} />

			<Separator orientation="vertical" className="bg-border mx-1 h-6" />

			{/* Heading Select */}
			<HeadingLevelButton editor={editor} />

			<Separator orientation="vertical" className="bg-border mx-1 h-6" />

			{/* Font Size */}
			<FontSizeButton editor={editor} />

			<Separator orientation="vertical" className="bg-border mx-1 h-6" />

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
			>
				<Strikethrough className="h-4 w-4" />
			</ToolbarButton>

			{/* Colors */}
			<TextColorButton editor={editor} />
			<HighlightColorButton editor={editor} />

			<Separator orientation="vertical" className="bg-border mx-1 h-6" />

			{/* Link, Image */}
			<LinkButton editor={editor} />
			<ImageButton editor={editor} />

			{/* Alignment, Line Height, Lists */}
			<AlignButton editor={editor} />
			<LineHeightButton editor={editor} />
			<ListButton editor={editor} />

			<Separator orientation="vertical" className="bg-border mx-1 h-6" />

			{/* Block Elements */}
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
				isActive={editor.isActive("blockquote")}
				tooltip="Blockquote"
			>
				<Quote className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().toggleCodeBlock().run()}
				isActive={editor.isActive("codeBlock")}
				tooltip="Code Block"
			>
				<Code className="h-4 w-4" />
			</ToolbarButton>
			<ToolbarButton
				onClick={() => editor.chain().focus().unsetAllMarks().run()}
				tooltip="Remove Formatting"
			>
				<RemoveFormatting className="h-4 w-4" />
			</ToolbarButton>
		</div>
	)
}
