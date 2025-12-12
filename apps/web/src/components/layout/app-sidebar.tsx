import { useState } from "react"
import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { api } from "@writer/backend/convex/_generated/api"
import type { Id } from "@writer/backend/convex/_generated/dataModel"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { RenameDocumentDialog } from "@/components/documents/rename-document-dialog"
import { CreateFolderDialog } from "@/components/folders/create-folder-dialog"
import { RenameFolderDialog } from "@/components/folders/rename-folder-dialog"
import { MoveToFolderDialog } from "@/components/folders/move-to-folder-dialog"
import {
	FileText,
	Plus,
	MoreHorizontal,
	Trash2,
	Copy,
	FolderOpen,
	Settings,
	Pencil,
	Folder,
	ChevronRight,
	FolderPlus,
	FilePlus,
	Undo2,
	Users,
	FolderInput,
	FolderSymlink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type DocumentId = Id<"documents">
type FolderId = Id<"folders">

interface FolderType {
	_id: FolderId
	_creationTime: number
	name: string
	ownerId: string
	parentId?: FolderId
	createdAt: number
}

interface DocumentType {
	_id: DocumentId
	_creationTime: number
	title: string
	content: string
	ownerId: string
	createdAt: number
	updatedAt: number
	isDeleted: boolean
	parentFolderId?: FolderId
}

export function AppSidebar() {
	const routerState = useRouterState()
	const currentPath = routerState.location.pathname

	const documentIdMatch = currentPath.match(/^\/documents\/(.+)$/)
	const currentDocumentId = documentIdMatch ? (documentIdMatch[1] as DocumentId) : undefined

	// Get current document to know its folder
	const currentDocument = useQuery(
		api.documents.getDocument,
		currentDocumentId ? { documentId: currentDocumentId } : "skip",
	)

	const folderContents = useQuery(api.folders.getFolderContents, {})
	const deletedDocuments = useQuery(api.documents.getDeletedDocuments)
	const sharedDocuments = useQuery(api.collaborators.getSharedDocuments)
	const deleteDocument = useMutation(api.documents.deleteDocument)
	const duplicateDocument = useMutation(api.documents.duplicateDocument)
	const deleteFolder = useMutation(api.folders.deleteFolder)
	const createDocument = useMutation(api.documents.createDocument)
	const restoreDocument = useMutation(api.documents.restoreDocument)
	const permanentlyDeleteDocument = useMutation(api.documents.permanentlyDeleteDocument)
	const emptyTrash = useMutation(api.documents.emptyTrash)
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
	const [folderToRename, setFolderToRename] = useState<{
		id: FolderId
		name: string
	} | null>(null)
	const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false)
	const [folderToDelete, setFolderToDelete] = useState<{
		id: FolderId
		name: string
	} | null>(null)
	const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false)
	const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false)
	const [documentToPermanentlyDelete, setDocumentToPermanentlyDelete] = useState<{
		id: DocumentId
		title: string
	} | null>(null)
	const [moveDialogOpen, setMoveDialogOpen] = useState(false)
	const [itemToMove, setItemToMove] = useState<{
		type: "document" | "folder"
		id: DocumentId | FolderId
		name: string
		currentFolderId?: FolderId
	} | null>(null)
	const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false)

	// Current folder context - use the current document's folder
	const currentFolderId = currentDocument?.parentFolderId

	const handleCreateDocument = async (folderId?: FolderId) => {
		const docId = await createDocument({ parentFolderId: folderId })
		navigate({ to: "/documents/$documentId", params: { documentId: docId } })
	}

	const handleDeleteDocument = async () => {
		if (!documentToDelete) return
		try {
			await deleteDocument({ documentId: documentToDelete.id })
			toast.success("Document moved to trash")
			if (currentDocumentId === documentToDelete.id) {
				navigate({ to: "/" })
			}
		} catch {
			toast.error("Failed to delete document")
		}
		setDeleteDialogOpen(false)
		setDocumentToDelete(null)
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

	const confirmDeleteDocument = (documentId: DocumentId, title: string) => {
		setDocumentToDelete({ id: documentId, title })
		setDeleteDialogOpen(true)
	}

	const openRenameDocumentDialog = (documentId: DocumentId, title: string) => {
		setDocumentToRename({ id: documentId, title })
		setRenameDialogOpen(true)
	}

	const handleDeleteFolder = async () => {
		if (!folderToDelete) return
		try {
			await deleteFolder({ folderId: folderToDelete.id, deleteContents: true })
			toast.success("Folder and contents deleted")
		} catch {
			toast.error("Failed to delete folder")
		}
		setDeleteFolderDialogOpen(false)
		setFolderToDelete(null)
	}

	const openRenameFolderDialog = (folderId: FolderId, name: string) => {
		setFolderToRename({ id: folderId, name })
		setRenameFolderDialogOpen(true)
	}

	const confirmDeleteFolder = (folderId: FolderId, name: string) => {
		setFolderToDelete({ id: folderId, name })
		setDeleteFolderDialogOpen(true)
	}

	const handleRestoreDocument = async (documentId: DocumentId) => {
		try {
			await restoreDocument({ documentId })
			toast.success("Document restored")
		} catch {
			toast.error("Failed to restore document")
		}
	}

	const handlePermanentlyDeleteDocument = async () => {
		if (!documentToPermanentlyDelete) return
		try {
			await permanentlyDeleteDocument({ documentId: documentToPermanentlyDelete.id })
			toast.success("Document permanently deleted")
		} catch {
			toast.error("Failed to delete document")
		}
		setPermanentDeleteDialogOpen(false)
		setDocumentToPermanentlyDelete(null)
	}

	const confirmPermanentDelete = (documentId: DocumentId, title: string) => {
		setDocumentToPermanentlyDelete({ id: documentId, title })
		setPermanentDeleteDialogOpen(true)
	}

	const openMoveDocumentDialog = (documentId: DocumentId, title: string, folderId?: FolderId) => {
		setItemToMove({ type: "document", id: documentId, name: title, currentFolderId: folderId })
		setMoveDialogOpen(true)
	}

	const openMoveFolderDialog = (folderId: FolderId, name: string, parentId?: FolderId) => {
		setItemToMove({ type: "folder", id: folderId, name, currentFolderId: parentId })
		setMoveDialogOpen(true)
	}

	const handleEmptyTrash = async () => {
		try {
			await emptyTrash({})
			toast.success("Trash emptied")
		} catch {
			toast.error("Failed to empty trash")
		}
		setEmptyTrashDialogOpen(false)
	}

	return (
		<>
			<Sidebar>
				<SidebarHeader>
					<div className="flex items-center justify-between px-2">
						<span className="text-lg font-semibold">Writer</span>
					</div>
					<div className="flex gap-2">
						<Button
							className="flex-1 justify-start gap-2"
							variant="outline"
							onClick={() => handleCreateDocument(currentFolderId)}
						>
							<Plus className="h-4 w-4" />
							New Document
						</Button>
						<CreateFolderDialog
							trigger={
								<Button variant="outline" size="icon">
									<FolderPlus className="h-4 w-4" />
								</Button>
							}
							parentId={currentFolderId}
						/>
					</div>
				</SidebarHeader>

				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>
							<FolderOpen className="mr-2 h-4 w-4" />
							Documents
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{folderContents === undefined ? (
									<>
										<SidebarMenuSkeleton showIcon />
										<SidebarMenuSkeleton showIcon />
										<SidebarMenuSkeleton showIcon />
									</>
								) : folderContents.folders.length === 0 && folderContents.documents.length === 0 ? (
									<div className="text-muted-foreground px-2 py-4 text-center text-sm">
										No documents yet.
										<br />
										Create your first document!
									</div>
								) : (
									<>
										{folderContents.folders.map((folder) => (
											<FolderMenuItem
												key={folder._id}
												folder={folder}
												currentDocumentId={currentDocumentId}
												onDeleteDocument={confirmDeleteDocument}
												onDuplicateDocument={handleDuplicateDocument}
												onRenameDocument={openRenameDocumentDialog}
												onRenameFolder={openRenameFolderDialog}
												onDeleteFolder={confirmDeleteFolder}
												onCreateDocument={handleCreateDocument}
												onMoveDocument={openMoveDocumentDialog}
												onMoveFolder={openMoveFolderDialog}
											/>
										))}
										{folderContents.documents.map((doc) => (
											<DocumentMenuItem
												key={doc._id}
												document={doc}
												isActive={currentDocumentId === doc._id}
												onDelete={() => confirmDeleteDocument(doc._id, doc.title)}
												onDuplicate={() => handleDuplicateDocument(doc._id)}
												onRename={() => openRenameDocumentDialog(doc._id, doc.title)}
												onMove={() =>
													openMoveDocumentDialog(doc._id, doc.title, doc.parentFolderId)
												}
											/>
										))}
									</>
								)}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>

					{/* Shared with me */}
					{sharedDocuments && sharedDocuments.length > 0 && (
						<SidebarGroup>
							<SidebarGroupLabel>
								<Users className="mr-2 h-4 w-4" />
								Shared with me
							</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{sharedDocuments.map((doc) => (
										<SidebarMenuItem key={doc._id}>
											<SidebarMenuButton asChild isActive={currentDocumentId === doc._id}>
												<Link to="/documents/$documentId" params={{ documentId: doc._id }}>
													<FileText className="h-4 w-4" />
													<span className="flex-1 truncate">{doc.title || "Untitled"}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					)}

					{/* Trash */}
					{deletedDocuments && deletedDocuments.length > 0 && (
						<SidebarGroup>
							<Collapsible>
								<CollapsibleTrigger asChild>
									<SidebarGroupLabel className="group/trash-header hover:bg-accent cursor-pointer rounded-md">
										<Trash2 className="mr-2 h-4 w-4" />
										Trash
										<span className="text-muted-foreground ml-auto text-xs">
											{deletedDocuments.length}
										</span>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className={cn(
														"ml-1 h-6 w-6 opacity-0 transition-opacity group-hover/trash-header:opacity-100",
														"data-[state=open]:opacity-100",
													)}
													onClick={(e) => e.stopPropagation()}
												>
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-48">
												<DropdownMenuItem
													onClick={(e) => {
														e.stopPropagation()
														setEmptyTrashDialogOpen(true)
													}}
													className="text-destructive focus:text-destructive"
												>
													<Trash2 className="mr-2 h-4 w-4" />
													Empty trash
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</SidebarGroupLabel>
								</CollapsibleTrigger>
								<CollapsibleContent>
									<SidebarGroupContent>
										<SidebarMenu>
											{deletedDocuments.map((doc) => (
												<SidebarMenuItem key={doc._id} className="group/trash-item">
													<SidebarMenuButton className="text-muted-foreground">
														<FileText className="h-4 w-4" />
														<span className="flex-1 truncate">{doc.title || "Untitled"}</span>
													</SidebarMenuButton>
													<DropdownMenu>
														<DropdownMenuTrigger asChild>
															<Button
																variant="ghost"
																size="icon"
																className={cn(
																	"absolute right-1 top-1.5 h-6 w-6 opacity-0 transition-opacity group-hover/trash-item:opacity-100",
																	"data-[state=open]:opacity-100",
																)}
															>
																<MoreHorizontal className="h-4 w-4" />
															</Button>
														</DropdownMenuTrigger>
														<DropdownMenuContent align="end" className="w-48">
															<DropdownMenuItem onClick={() => handleRestoreDocument(doc._id)}>
																<Undo2 className="mr-2 h-4 w-4" />
																Restore
															</DropdownMenuItem>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																onClick={() => confirmPermanentDelete(doc._id, doc.title)}
																className="text-destructive focus:text-destructive"
															>
																<Trash2 className="mr-2 h-4 w-4" />
																Delete permanently
															</DropdownMenuItem>
														</DropdownMenuContent>
													</DropdownMenu>
												</SidebarMenuItem>
											))}
										</SidebarMenu>
									</SidebarGroupContent>
								</CollapsibleContent>
							</Collapsible>
						</SidebarGroup>
					)}
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

			{documentToRename && (
				<RenameDocumentDialog
					open={renameDialogOpen}
					onOpenChange={setRenameDialogOpen}
					documentId={documentToRename.id}
					currentTitle={documentToRename.title}
				/>
			)}

			{folderToRename && (
				<RenameFolderDialog
					open={renameFolderDialogOpen}
					onOpenChange={setRenameFolderDialogOpen}
					folderId={folderToRename.id}
					currentName={folderToRename.name}
				/>
			)}

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

			<AlertDialog open={deleteFolderDialogOpen} onOpenChange={setDeleteFolderDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Folder</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{folderToDelete?.name || "this folder"}"? All
							documents and subfolders inside will also be deleted.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteFolder}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={permanentDeleteDialogOpen} onOpenChange={setPermanentDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Permanently Delete Document</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to permanently delete "
							{documentToPermanentlyDelete?.title || "this document"}"? This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handlePermanentlyDeleteDocument}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete permanently
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{itemToMove && (
				<MoveToFolderDialog
					open={moveDialogOpen}
					onOpenChange={setMoveDialogOpen}
					documentId={itemToMove.type === "document" ? (itemToMove.id as DocumentId) : undefined}
					folderId={itemToMove.type === "folder" ? (itemToMove.id as FolderId) : undefined}
					currentFolderId={itemToMove.currentFolderId}
					itemName={itemToMove.name}
				/>
			)}

			<AlertDialog open={emptyTrashDialogOpen} onOpenChange={setEmptyTrashDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Empty Trash</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to permanently delete all {deletedDocuments?.length ?? 0}{" "}
							documents in trash? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleEmptyTrash}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Empty trash
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

interface FolderMenuItemProps {
	folder: FolderType
	currentDocumentId?: DocumentId
	onDeleteDocument: (id: DocumentId, title: string) => void
	onDuplicateDocument: (id: DocumentId) => void
	onRenameDocument: (id: DocumentId, title: string) => void
	onRenameFolder: (id: FolderId, name: string) => void
	onDeleteFolder: (id: FolderId, name: string) => void
	onCreateDocument: (folderId?: FolderId) => void
	onMoveDocument: (id: DocumentId, title: string, folderId?: FolderId) => void
	onMoveFolder: (id: FolderId, name: string, parentId?: FolderId) => void
}

function FolderMenuItem({
	folder,
	currentDocumentId,
	onDeleteDocument,
	onDuplicateDocument,
	onRenameDocument,
	onRenameFolder,
	onDeleteFolder,
	onCreateDocument,
	onMoveDocument,
	onMoveFolder,
}: FolderMenuItemProps) {
	const [isOpen, setIsOpen] = useState(false)
	const folderContents = useQuery(
		api.folders.getFolderContents,
		isOpen ? { folderId: folder._id } : "skip",
	)

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div>
					<Collapsible open={isOpen} onOpenChange={setIsOpen}>
						<SidebarMenuItem>
							<CollapsibleTrigger asChild>
								<SidebarMenuButton className="w-full">
									<ChevronRight
										className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-90")}
									/>
									{isOpen ? (
										<FolderOpen className="h-4 w-4 shrink-0" />
									) : (
										<Folder className="h-4 w-4 shrink-0" />
									)}
									<span className="flex-1 truncate">{folder.name}</span>
								</SidebarMenuButton>
							</CollapsibleTrigger>
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
									<DropdownMenuItem onClick={() => onCreateDocument(folder._id)}>
										<FilePlus className="mr-2 h-4 w-4" />
										New Document
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={() => onRenameFolder(folder._id, folder.name)}>
										<Pencil className="mr-2 h-4 w-4" />
										Rename
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => onMoveFolder(folder._id, folder.name, folder.parentId)}
									>
										<FolderInput className="mr-2 h-4 w-4" />
										Move to...
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() => onDeleteFolder(folder._id, folder.name)}
										className="text-destructive focus:text-destructive"
									>
										<Trash2 className="mr-2 h-4 w-4" />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</SidebarMenuItem>
						<CollapsibleContent>
							<SidebarMenu className="ml-4 border-l pl-2">
								{folderContents === undefined ? (
									<SidebarMenuSkeleton showIcon />
								) : (
									<>
										{folderContents.folders.map((subfolder) => (
											<FolderMenuItem
												key={subfolder._id}
												folder={subfolder}
												currentDocumentId={currentDocumentId}
												onDeleteDocument={onDeleteDocument}
												onDuplicateDocument={onDuplicateDocument}
												onRenameDocument={onRenameDocument}
												onRenameFolder={onRenameFolder}
												onDeleteFolder={onDeleteFolder}
												onCreateDocument={onCreateDocument}
												onMoveDocument={onMoveDocument}
												onMoveFolder={onMoveFolder}
											/>
										))}
										{folderContents.documents.map((doc) => (
											<DocumentMenuItem
												key={doc._id}
												document={doc}
												isActive={currentDocumentId === doc._id}
												onDelete={() => onDeleteDocument(doc._id, doc.title)}
												onDuplicate={() => onDuplicateDocument(doc._id)}
												onRename={() => onRenameDocument(doc._id, doc.title)}
												onMove={() => onMoveDocument(doc._id, doc.title, doc.parentFolderId)}
											/>
										))}
										{folderContents.folders.length === 0 &&
											folderContents.documents.length === 0 && (
												<div className="text-muted-foreground px-2 py-2 text-xs">Empty folder</div>
											)}
									</>
								)}
							</SidebarMenu>
						</CollapsibleContent>
					</Collapsible>
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-48">
				<ContextMenuItem onClick={() => onCreateDocument(folder._id)}>
					<FilePlus className="mr-2 h-4 w-4" />
					New Document
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={() => onRenameFolder(folder._id, folder.name)}>
					<Pencil className="mr-2 h-4 w-4" />
					Rename
					<ContextMenuShortcut>F2</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem onClick={() => onMoveFolder(folder._id, folder.name, folder.parentId)}>
					<FolderInput className="mr-2 h-4 w-4" />
					Move to...
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem
					onClick={() => onDeleteFolder(folder._id, folder.name)}
					className="text-destructive focus:text-destructive"
				>
					<Trash2 className="mr-2 h-4 w-4" />
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	)
}

interface DocumentMenuItemProps {
	document: DocumentType
	isActive: boolean
	onDelete: () => void
	onDuplicate: () => void
	onRename: () => void
	onMove: () => void
}

function DocumentMenuItem({
	document,
	isActive,
	onDelete,
	onDuplicate,
	onRename,
	onMove,
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
							<DropdownMenuItem onClick={onMove}>
								<FolderSymlink className="mr-2 h-4 w-4" />
								Move to...
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
				<ContextMenuItem onClick={onMove}>
					<FolderSymlink className="mr-2 h-4 w-4" />
					Move to...
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
					<Trash2 className="mr-2 h-4 w-4" />
					Delete
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	)
}
