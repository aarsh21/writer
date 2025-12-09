import { useState, useEffect } from "react"
import { useMutation } from "convex/react"
import { api } from "@writer/backend/convex/_generated/api"
import type { GenericId } from "convex/values"
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

type DocumentId = GenericId<"documents">

interface RenameDocumentDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	documentId: DocumentId
	currentTitle: string
	onRenamed?: () => void
}

export function RenameDocumentDialog({
	open,
	onOpenChange,
	documentId,
	currentTitle,
	onRenamed,
}: RenameDocumentDialogProps) {
	const [title, setTitle] = useState(currentTitle)
	const [isRenaming, setIsRenaming] = useState(false)

	const renameDocument = useMutation(api.documents.renameDocument)

	// Reset title when dialog opens with new document
	useEffect(() => {
		if (open) {
			setTitle(currentTitle)
		}
	}, [open, currentTitle])

	const handleRename = async () => {
		const trimmed = title.trim()
		if (!trimmed || trimmed === currentTitle) {
			onOpenChange(false)
			return
		}

		setIsRenaming(true)
		try {
			await renameDocument({
				documentId,
				title: trimmed,
			})
			onOpenChange(false)
			onRenamed?.()
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
					<DialogTitle>Rename Document</DialogTitle>
					<DialogDescription>Enter a new name for this document.</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="title">Title</Label>
						<Input
							id="title"
							placeholder="Document title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							onKeyDown={handleKeyDown}
							autoFocus
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleRename} disabled={isRenaming || !title.trim()}>
						{isRenaming ? "Renaming..." : "Rename"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
