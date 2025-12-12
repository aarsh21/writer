import { useState, useRef, useEffect } from "react"
import type { Id } from "@writer/backend/convex/_generated/dataModel"
import { useMutation, useQuery } from "convex/react"
import { api } from "@writer/backend/convex/_generated/api"
import { useNavigate } from "@tanstack/react-router"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
	MoreHorizontal,
	Share2,
	Download,
	Trash2,
	Clock,
	FileText,
	Copy,
	History,
	Pencil,
	Loader2,
	Check,
	AlertCircle,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { ShareDocumentDialog } from "./share-document-dialog"
import { ExportDocumentDialog } from "./export-document-dialog"
import { RenameDocumentDialog } from "./rename-document-dialog"
import { VersionHistoryDialog } from "./version-history-dialog"
import { toast } from "sonner"
import { useEditorStore } from "@/store/use-editor-store"

type DocumentId = Id<"documents">

interface DocumentHeaderProps {
	documentId: DocumentId
	title: string
	updatedAt: number
	onTitleChange: (title: string) => void
}

export function DocumentHeader({
	documentId,
	title,
	updatedAt,
	onTitleChange,
}: DocumentHeaderProps) {
	const navigate = useNavigate()
	const [isEditing, setIsEditing] = useState(false)
	const [editValue, setEditValue] = useState(title)
	const inputRef = useRef<HTMLInputElement>(null)

	// Dialog states
	const [shareDialogOpen, setShareDialogOpen] = useState(false)
	const [exportDialogOpen, setExportDialogOpen] = useState(false)
	const [renameDialogOpen, setRenameDialogOpen] = useState(false)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)

	// Mutations
	const deleteDocument = useMutation(api.documents.deleteDocument)
	const duplicateDocument = useMutation(api.documents.duplicateDocument)

	// Get active users for avatar display
	const activeUsers = useQuery(api.presence.getActiveUsers, { documentId })

	// Update edit value when title changes externally
	useEffect(() => {
		if (!isEditing) {
			setEditValue(title)
		}
	}, [title, isEditing])

	// Focus input when entering edit mode
	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	const handleSave = () => {
		const trimmed = editValue.trim()
		if (trimmed && trimmed !== title) {
			onTitleChange(trimmed)
		} else {
			setEditValue(title) // Reset if empty
		}
		setIsEditing(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSave()
		} else if (e.key === "Escape") {
			setEditValue(title)
			setIsEditing(false)
		}
	}

	const handleDelete = async () => {
		try {
			await deleteDocument({ documentId })
			toast.success("Document deleted")
			navigate({ to: "/" })
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete document")
		}
		setDeleteDialogOpen(false)
	}

	const handleDuplicate = async () => {
		try {
			const newDocId = await duplicateDocument({ documentId })
			toast.success("Document duplicated")
			navigate({ to: "/documents/$documentId", params: { documentId: newDocId } })
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to duplicate document")
		}
	}

	const activeUsersList = activeUsers || []
	const saveStatus = useEditorStore((state) => state.saveStatus)

	return (
		<>
			<header className="border-border bg-background flex h-14 shrink-0 items-center gap-2 border-b px-4">
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="mr-2 h-4" />

				{/* Document Icon */}
				<FileText className="text-muted-foreground h-4 w-4" />

				{/* Editable Title */}
				{isEditing ? (
					<Input
						ref={inputRef}
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onBlur={handleSave}
						onKeyDown={handleKeyDown}
						className="h-8 max-w-md text-lg font-semibold"
						placeholder="Document title"
					/>
				) : (
					<button
						type="button"
						onClick={() => setIsEditing(true)}
						className={cn(
							"text-foreground max-w-md truncate text-lg font-semibold",
							"hover:bg-accent rounded px-1 transition-colors",
							"text-left",
						)}
					>
						{title || "Untitled"}
					</button>
				)}

				{/* Save Status Indicator */}
				<TooltipProvider delayDuration={300}>
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge
								variant="secondary"
								className={cn(
									"text-muted-foreground ml-2 gap-1 transition-colors",
									saveStatus === "error" && "text-destructive",
								)}
							>
								{saveStatus === "pending" && (
									<>
										<Clock className="h-3 w-3" />
										Editing...
									</>
								)}
								{saveStatus === "saving" && (
									<>
										<Loader2 className="h-3 w-3 animate-spin" />
										Saving...
									</>
								)}
								{saveStatus === "saved" && (
									<>
										<Check className="h-3 w-3" />
										Saved
									</>
								)}
								{saveStatus === "error" && (
									<>
										<AlertCircle className="h-3 w-3" />
										Error
									</>
								)}
								{saveStatus === "idle" && (
									<>
										<Clock className="h-3 w-3" />
										{formatDistanceToNow(updatedAt, { addSuffix: true })}
									</>
								)}
							</Badge>
						</TooltipTrigger>
						<TooltipContent>
							{saveStatus === "pending" && "You have unsaved changes"}
							{saveStatus === "saving" && "Saving your changes..."}
							{saveStatus === "saved" && "All changes saved"}
							{saveStatus === "error" && "Failed to save changes"}
							{saveStatus === "idle" && `Last edited ${new Date(updatedAt).toLocaleString()}`}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				{/* Spacer */}
				<div className="flex-1" />

				{/* Active Collaborators */}
				{activeUsersList.length > 0 && (
					<TooltipProvider delayDuration={300}>
						<div className="mr-2 flex -space-x-2">
							{activeUsersList.slice(0, 3).map((user, index) => (
								<Tooltip key={user._id}>
									<TooltipTrigger asChild>
										<Avatar className="border-background h-7 w-7 border-2">
											<AvatarFallback
												className="text-xs"
												style={{ backgroundColor: user.userColor || getColorForIndex(index) }}
											>
												{user.userName?.slice(0, 2).toUpperCase() || "?"}
											</AvatarFallback>
										</Avatar>
									</TooltipTrigger>
									<TooltipContent>{user.userName || "Unknown"}</TooltipContent>
								</Tooltip>
							))}
							{activeUsersList.length > 3 && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Avatar className="border-background h-7 w-7 border-2">
											<AvatarFallback className="bg-muted text-xs">
												+{activeUsersList.length - 3}
											</AvatarFallback>
										</Avatar>
									</TooltipTrigger>
									<TooltipContent>
										{activeUsersList.length - 3} more collaborator
										{activeUsersList.length - 3 > 1 ? "s" : ""}
									</TooltipContent>
								</Tooltip>
							)}
						</div>
					</TooltipProvider>
				)}

				{/* Action Buttons */}
				<div className="flex items-center gap-1">
					{/* Share Button */}
					<TooltipProvider delayDuration={300}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="gap-2"
									onClick={() => setShareDialogOpen(true)}
								>
									<Share2 className="h-4 w-4" />
									Share
								</Button>
							</TooltipTrigger>
							<TooltipContent>Share this document</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					{/* More Actions Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem onClick={() => setRenameDialogOpen(true)}>
								<Pencil className="mr-2 h-4 w-4" />
								Rename
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleDuplicate}>
								<Copy className="mr-2 h-4 w-4" />
								Duplicate
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setVersionHistoryOpen(true)}>
								<History className="mr-2 h-4 w-4" />
								Version History
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
								<Download className="mr-2 h-4 w-4" />
								Export
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => setDeleteDialogOpen(true)}
								className="text-destructive focus:text-destructive"
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>

			{/* Share Dialog */}
			<ShareDocumentDialog
				open={shareDialogOpen}
				onOpenChange={setShareDialogOpen}
				documentId={documentId}
				documentTitle={title}
			/>

			{/* Export Dialog */}
			<ExportDocumentDialog
				open={exportDialogOpen}
				onOpenChange={setExportDialogOpen}
				documentId={documentId}
				documentTitle={title}
			/>

			{/* Rename Dialog */}
			<RenameDocumentDialog
				open={renameDialogOpen}
				onOpenChange={setRenameDialogOpen}
				documentId={documentId}
				currentTitle={title}
			/>

			{/* Version History Dialog */}
			<VersionHistoryDialog
				open={versionHistoryOpen}
				onOpenChange={setVersionHistoryOpen}
				documentId={documentId}
			/>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Document</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{title}"? This action can be undone from the trash.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

function getColorForIndex(index: number): string {
	const colors = [
		"#ef4444", // red
		"#f97316", // orange
		"#eab308", // yellow
		"#22c55e", // green
		"#06b6d4", // cyan
		"#3b82f6", // blue
		"#8b5cf6", // violet
		"#ec4899", // pink
	]
	return colors[index % colors.length]
}
