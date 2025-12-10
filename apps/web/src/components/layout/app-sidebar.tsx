import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "@writer/backend/convex/_generated/api"
import type { GenericId } from "convex/values"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarSeparator,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
	ContextMenuShortcut,
} from "@/components/ui/context-menu"
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
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog"
import { RenameDocumentDialog } from "@/components/documents/rename-document-dialog"
import {
	FileText,
	Plus,
	MoreHorizontal,
	Trash2,
	Copy,
	Clock,
	FolderOpen,
	Settings,
	Pencil,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Use GenericId for document IDs
type DocumentId = GenericId<"documents">

export function AppSidebar() {
	const routerState = useRouterState()
	const currentPath = routerState.location.pathname

	// Extract document ID from path if on a document page
	const documentIdMatch = currentPath.match(/^\/documents\/(.+)$/)
	const currentDocumentId = documentIdMatch ? (documentIdMatch[1] as DocumentId) : undefined

	const documents = useQuery(api.documents.listDocuments, {})
	const recentDocuments = useQuery(api.userPreferences.getRecentDocumentsWithData, { limit: 5 })
	const deleteDocument = useMutation(api.documents.deleteDocument)
	const duplicateDocument = useMutation(api.documents.duplicateDocument)
	const navigate = useNavigate()

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [documentToDelete, setDocumentToDelete] = useState<{
		id: DocumentId
		title: string
	} | null>(null)
	const [renameDialogOpen, setRenameDialogOpen] = useState(false)
	const [documentToRename, setDocumentToRename] = useState<{
		id: DocumentId
		title: string
	} | null>(null)

	const handleDocumentCreated = (documentId: string) => {
		navigate({ to: "/documents/$documentId", params: { documentId } })
	}

	const handleDeleteDocument = async () => {
		if (documentToDelete) {
			try {
				await deleteDocument({ documentId: documentToDelete.id })
				toast.success("Document deleted")
				// If we deleted the current document, go to dashboard
				if (currentDocumentId === documentToDelete.id) {
					navigate({ to: "/" })
				}
			} catch {
				toast.error("Failed to delete document")
			}
			setDeleteDialogOpen(false)
			setDocumentToDelete(null)
		}
	}

	const handleDuplicateDocument = async (documentId: DocumentId) => {
		try {
			const newDocId = await duplicateDocument({ documentId })
			toast.success("Document duplicated")
			navigate({ to: "/documents/$documentId", params: { documentId: newDocId } })
		} catch {
			toast.error("Failed to duplicate document")
		}
	}

	const confirmDelete = (documentId: DocumentId, title: string) => {
		setDocumentToDelete({ id: documentId, title })
		setDeleteDialogOpen(true)
	}

	const openRenameDialog = (documentId: DocumentId, title: string) => {
		setDocumentToRename({ id: documentId, title })
		setRenameDialogOpen(true)
	}

	return (
		<>
			<Sidebar>
				<SidebarHeader>
					<div className="flex items-center justify-between px-2">
						<span className="text-lg font-semibold">Writer</span>
					</div>
					<CreateDocumentDialog
						trigger={
							<Button className="w-full justify-start gap-2" variant="outline">
								<Plus className="h-4 w-4" />
								New Document
							</Button>
						}
						onCreated={handleDocumentCreated}
					/>
				</SidebarHeader>

				<SidebarContent>
					{/* Recent Documents */}
					{recentDocuments && recentDocuments.length > 0 && (
						<SidebarGroup>
							<SidebarGroupLabel>
								<Clock className="mr-2 h-4 w-4" />
								Recent
							</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{recentDocuments.map((doc) => (
										<DocumentMenuItem
											key={doc._id}
											document={doc}
											isActive={currentDocumentId === doc._id}
											onDelete={() => confirmDelete(doc._id, doc.title)}
											onDuplicate={() => handleDuplicateDocument(doc._id)}
											onRename={() => openRenameDialog(doc._id, doc.title)}
										/>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					)}

					<SidebarSeparator />

					{/* All Documents */}
					<SidebarGroup>
						<SidebarGroupLabel>
							<FolderOpen className="mr-2 h-4 w-4" />
							All Documents
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{documents === undefined ? (
									// Loading state
									<>
										<SidebarMenuSkeleton showIcon />
										<SidebarMenuSkeleton showIcon />
										<SidebarMenuSkeleton showIcon />
									</>
								) : documents.length === 0 ? (
									<div className="text-muted-foreground px-2 py-4 text-center text-sm">
										No documents yet.
										<br />
										Create your first document!
									</div>
								) : (
									documents.map((doc) => (
										<DocumentMenuItem
											key={doc._id}
											document={doc}
											isActive={currentDocumentId === doc._id}
											onDelete={() => confirmDelete(doc._id, doc.title)}
											onDuplicate={() => handleDuplicateDocument(doc._id)}
											onRename={() => openRenameDialog(doc._id, doc.title)}
										/>
									))
								)}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>

				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild>
								<Link to="/settings">
									<Settings className="h-4 w-4" />
									Settings
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			</Sidebar>

			{/* Rename Dialog */}
			{documentToRename && (
				<RenameDocumentDialog
					open={renameDialogOpen}
					onOpenChange={setRenameDialogOpen}
					documentId={documentToRename.id}
					currentTitle={documentToRename.title}
				/>
			)}

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Document</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{documentToDelete?.title || "this document"}"? This
							action can be undone from the trash.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteDocument}
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

interface DocumentMenuItemProps {
	document: {
		_id: DocumentId
		title: string
		updatedAt: number
	}
	isActive: boolean
	onDelete: () => void
	onDuplicate: () => void
	onRename: () => void
}

function DocumentMenuItem({
	document,
	isActive,
	onDelete,
	onDuplicate,
	onRename,
}: DocumentMenuItemProps) {
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<SidebarMenuItem>
					<SidebarMenuButton asChild isActive={isActive}>
						<Link to="/documents/$documentId" params={{ documentId: document._id }}>
							<FileText className="h-4 w-4" />
							<span className="flex-1 truncate">{document.title || "Untitled"}</span>
						</Link>
					</SidebarMenuButton>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className={cn(
									"absolute right-1 top-1.5 h-6 w-6 opacity-0 transition-opacity group-hover/menu-item:opacity-100",
									"data-[state=open]:opacity-100",
								)}
							>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem onClick={onRename}>
								<Pencil className="mr-2 h-4 w-4" />
								Rename
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onDuplicate}>
								<Copy className="mr-2 h-4 w-4" />
								Duplicate
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={onDelete}
								className="text-destructive focus:text-destructive"
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</SidebarMenuItem>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-48">
				<ContextMenuItem onClick={onRename}>
					<Pencil className="mr-2 h-4 w-4" />
					Rename
					<ContextMenuShortcut>F2</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem onClick={onDuplicate}>
					<Copy className="mr-2 h-4 w-4" />
					Duplicate
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={onDelete} variant="destructive">
					<Trash2 className="mr-2 h-4 w-4" />
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	)
}
