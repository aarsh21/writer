import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@writer/backend/convex/_generated/api"
import { useNavigate } from "@tanstack/react-router"
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
import { Plus } from "lucide-react"

interface CreateDocumentDialogProps {
	trigger?: React.ReactNode
	onCreated?: (documentId: string) => void
}

export function CreateDocumentDialog({ trigger, onCreated }: CreateDocumentDialogProps) {
	const [open, setOpen] = useState(false)
	const [title, setTitle] = useState("")
	const [isCreating, setIsCreating] = useState(false)
	const navigate = useNavigate()

	const createDocument = useMutation(api.documents.createDocument)

	const handleCreate = async () => {
		setIsCreating(true)
		try {
			const documentId = await createDocument({
				title: title.trim() || "Untitled Document",
			})
			setOpen(false)
			setTitle("")
			if (onCreated) {
				onCreated(documentId)
			} else {
				navigate({ to: "/documents/$documentId", params: { documentId } })
			}
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
					<Button className="gap-2">
						<Plus className="h-4 w-4" />
						New Document
					</Button>
				)}
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create New Document</DialogTitle>
					<DialogDescription>
						Enter a title for your new document. You can change it later.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="title">Title</Label>
						<Input
							id="title"
							placeholder="Untitled Document"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							onKeyDown={handleKeyDown}
							autoFocus
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button onClick={handleCreate} disabled={isCreating}>
						{isCreating ? "Creating..." : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
