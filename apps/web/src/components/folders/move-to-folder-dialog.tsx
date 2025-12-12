import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@writer/backend/convex/_generated/api"
import type { Id } from "@writer/backend/convex/_generated/dataModel"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Folder, FolderOpen, ChevronRight, Home } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface MoveToFolderDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	documentId?: Id<"documents">
	folderId?: Id<"folders">
	currentFolderId?: Id<"folders">
	itemName: string
}

export function MoveToFolderDialog({
	open,
	onOpenChange,
	documentId,
	folderId,
	currentFolderId,
	itemName,
}: MoveToFolderDialogProps) {
	const [selectedFolder, setSelectedFolder] = useState<Id<"folders"> | null>(null)
	const [isMoving, setIsMoving] = useState(false)
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

	const folders = useQuery(api.folders.listFolders, {})
	const moveDocument = useMutation(api.documents.moveDocument)
	const moveFolder = useMutation(api.folders.moveFolder)

	const handleMove = async () => {
		setIsMoving(true)
		try {
			if (documentId) {
				await moveDocument({
					documentId,
					targetFolderId: selectedFolder ?? undefined,
				})
			} else if (folderId) {
				await moveFolder({
					folderId,
					newParentId: selectedFolder ?? undefined,
				})
			}
			onOpenChange(false)
			toast.success(`Moved "${itemName}"`)
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to move item")
		} finally {
			setIsMoving(false)
		}
	}

	const toggleExpand = (id: string) => {
		const newExpanded = new Set(expandedFolders)
		if (newExpanded.has(id)) {
			newExpanded.delete(id)
		} else {
			newExpanded.add(id)
		}
		setExpandedFolders(newExpanded)
	}

	const rootFolders = folders?.filter((f) => !f.parentId) ?? []

	const renderFolder = (folder: NonNullable<typeof folders>[number], depth = 0) => {
		const isSelected = selectedFolder === folder._id
		const isCurrentFolder = currentFolderId === folder._id
		const isExpanded = expandedFolders.has(folder._id)
		const childFolders = folders?.filter((f) => f.parentId === folder._id) ?? []
		const hasChildren = childFolders.length > 0
		const isSelf = folderId === folder._id

		return (
			<div key={folder._id}>
				<button
					type="button"
					onClick={() => !isSelf && setSelectedFolder(folder._id)}
					disabled={isSelf}
					className={cn(
						"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
						isSelected && "bg-primary text-primary-foreground",
						!isSelected && !isSelf && "hover:bg-accent",
						isCurrentFolder && !isSelected && "bg-accent/50",
						isSelf && "cursor-not-allowed opacity-50",
					)}
					style={{ paddingLeft: `${depth * 16 + 8}px` }}
				>
					{hasChildren && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation()
								toggleExpand(folder._id)
							}}
							className="hover:bg-accent rounded p-0.5"
						>
							<ChevronRight
								className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")}
							/>
						</button>
					)}
					{!hasChildren && <span className="w-4" />}
					{isExpanded ? (
						<FolderOpen className="h-4 w-4 shrink-0" />
					) : (
						<Folder className="h-4 w-4 shrink-0" />
					)}
					<span className="truncate">{folder.name}</span>
					{isCurrentFolder && (
						<span className="text-muted-foreground ml-auto text-xs">(current)</span>
					)}
				</button>
				{isExpanded && childFolders.map((child) => renderFolder(child, depth + 1))}
			</div>
		)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Move "{itemName}"</DialogTitle>
					<DialogDescription>Select a destination folder.</DialogDescription>
				</DialogHeader>
				<div className="max-h-[300px] overflow-y-auto rounded-md border p-2">
					{/* Root option */}
					<button
						type="button"
						onClick={() => setSelectedFolder(null)}
						className={cn(
							"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
							selectedFolder === null && "bg-primary text-primary-foreground",
							selectedFolder !== null && "hover:bg-accent",
							!currentFolderId && selectedFolder !== null && "bg-accent/50",
						)}
					>
						<span className="w-4" />
						<Home className="h-4 w-4 shrink-0" />
						<span>Root (No folder)</span>
						{!currentFolderId && (
							<span className="text-muted-foreground ml-auto text-xs">(current)</span>
						)}
					</button>
					{/* Folders */}
					{rootFolders.map((folder) => renderFolder(folder))}
					{folders?.length === 0 && (
						<div className="text-muted-foreground py-4 text-center text-sm">
							No folders yet. Create one first.
						</div>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleMove} disabled={isMoving}>
						{isMoving ? "Moving..." : "Move"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
