import { useState } from "react"
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
	DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FolderPlus } from "lucide-react"
import { toast } from "sonner"

interface CreateFolderDialogProps {
	trigger?: React.ReactNode
	parentId?: Id<"folders">
	onCreated?: (folderId: Id<"folders">) => void
}

export function CreateFolderDialog({ trigger, parentId, onCreated }: CreateFolderDialogProps) {
	const [open, setOpen] = useState(false)
	const [name, setName] = useState("")
	const [isCreating, setIsCreating] = useState(false)

	const createFolder = useMutation(api.folders.createFolder)

	const handleCreate = async () => {
		if (!name.trim()) {
			toast.error("Folder name is required")
			return
		}

		setIsCreating(true)
		try {
			const folderId = await createFolder({
				name: name.trim(),
				parentId,
			})
			setOpen(false)
			setName("")
			toast.success("Folder created")
			onCreated?.(folderId)
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to create folder")
		} finally {
			setIsCreating(false)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !isCreating) {
			handleCreate()
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="outline" className="gap-2">
						<FolderPlus className="h-4 w-4" />
						New Folder
					</Button>
				)}
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create New Folder</DialogTitle>
					<DialogDescription>Enter a name for your new folder.</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="folder-name">Name</Label>
						<Input
							id="folder-name"
							placeholder="My Folder"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={handleKeyDown}
							autoFocus
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
						{isCreating ? "Creating..." : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
