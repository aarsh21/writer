import { useState, useEffect } from "react"
import { useMutation } from "convex/react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface RenameFolderDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	folderId: Id<"folders">
	currentName: string
}

export function RenameFolderDialog({
	open,
	onOpenChange,
	folderId,
	currentName,
}: RenameFolderDialogProps) {
	const [name, setName] = useState(currentName)
	const [isRenaming, setIsRenaming] = useState(false)

	const renameFolder = useMutation(api.folders.renameFolder)

	useEffect(() => {
		if (open) {
			setName(currentName)
		}
	}, [open, currentName])

	const handleRename = async () => {
		if (!name.trim()) {
			toast.error("Folder name is required")
			return
		}

		if (name.trim() === currentName) {
			onOpenChange(false)
			return
		}

		setIsRenaming(true)
		try {
			await renameFolder({
				folderId,
				name: name.trim(),
			})
			onOpenChange(false)
			toast.success("Folder renamed")
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to rename folder")
		} finally {
			setIsRenaming(false)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !isRenaming) {
			handleRename()
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Rename Folder</DialogTitle>
					<DialogDescription>Enter a new name for this folder.</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="folder-name">Name</Label>
						<Input
							id="folder-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={handleKeyDown}
							autoFocus
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleRename} disabled={isRenaming || !name.trim()}>
						{isRenaming ? "Renaming..." : "Rename"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
