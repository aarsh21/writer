import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@writer/backend/convex/_generated/api"
import type { Id } from "@writer/backend/convex/_generated/dataModel"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
import { History, RotateCcw, Trash2, Eye } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface VersionHistoryDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	documentId: Id<"documents">
}

interface Version {
	_id: Id<"documentVersions">
	_creationTime: number
	documentId: Id<"documents">
	content: string
	title: string
	createdAt: number
	createdBy: string
}

export function VersionHistoryDialog({
	open,
	onOpenChange,
	documentId,
}: VersionHistoryDialogProps) {
	const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
	const [previewMode, setPreviewMode] = useState(false)
	const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
	const [isRestoring, setIsRestoring] = useState(false)

	const versions = useQuery(api.versions.listVersions, { documentId, limit: 50 })
	const restoreVersion = useMutation(api.versions.restoreVersion)
	const deleteVersion = useMutation(api.versions.deleteVersion)
	const createVersion = useMutation(api.versions.createVersion)

	const handleRestore = async () => {
		if (!selectedVersion) return

		setIsRestoring(true)
		try {
			await restoreVersion({ versionId: selectedVersion._id })
			toast.success("Version restored")
			setRestoreDialogOpen(false)
			onOpenChange(false)
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to restore version")
		} finally {
			setIsRestoring(false)
		}
	}

	const handleDelete = async (versionId: Id<"documentVersions">) => {
		try {
			await deleteVersion({ versionId })
			toast.success("Version deleted")
			if (selectedVersion?._id === versionId) {
				setSelectedVersion(null)
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete version")
		}
	}

	const handleCreateSnapshot = async () => {
		try {
			await createVersion({ documentId })
			toast.success("Version snapshot created")
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to create snapshot")
		}
	}

	const getContentPreview = (content: string) => {
		try {
			const parsed = JSON.parse(content)
			const text = extractTextFromContent(parsed)
			return text.slice(0, 200) + (text.length > 200 ? "..." : "")
		} catch {
			return "Unable to preview content"
		}
	}

	const extractTextFromContent = (node: unknown): string => {
		if (!node || typeof node !== "object") return ""
		const n = node as { type?: string; text?: string; content?: unknown[] }
		if (n.type === "text" && n.text) return n.text
		if (n.content && Array.isArray(n.content)) {
			return n.content.map(extractTextFromContent).join(" ")
		}
		return ""
	}

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<History className="h-5 w-5" />
							Version History
						</DialogTitle>
						<DialogDescription>
							View and restore previous versions of this document.
						</DialogDescription>
					</DialogHeader>

					<div className="flex gap-4">
						{/* Version list */}
						<div className="w-1/3 border-r pr-4">
							<div className="mb-3 flex items-center justify-between">
								<span className="text-muted-foreground text-sm">
									{versions?.length ?? 0} versions
								</span>
								<Button variant="outline" size="sm" onClick={handleCreateSnapshot}>
									Save Snapshot
								</Button>
							</div>
							<ScrollArea className="h-[400px]">
								{versions?.length === 0 && (
									<div className="text-muted-foreground py-8 text-center text-sm">
										No versions yet. Versions are created automatically as you edit.
									</div>
								)}
								{versions?.map((version, index) => (
									<button
										key={version._id}
										type="button"
										onClick={() => {
											setSelectedVersion(version)
											setPreviewMode(false)
										}}
										className={cn(
											"mb-2 w-full rounded-md border p-3 text-left transition-colors",
											selectedVersion?._id === version._id
												? "border-primary bg-accent"
												: "hover:bg-accent/50",
										)}
									>
										<div className="flex items-center gap-2">
											<span className="font-medium">{version.title || "Untitled"}</span>
											{index === 0 && (
												<Badge variant="secondary" className="text-xs">
													Latest
												</Badge>
											)}
										</div>
										<div className="text-muted-foreground mt-1 text-xs">
											{formatDistanceToNow(version.createdAt, { addSuffix: true })}
										</div>
									</button>
								))}
							</ScrollArea>
						</div>

						{/* Version details */}
						<div className="flex-1">
							{selectedVersion ? (
								<div className="space-y-4">
									<div>
										<h3 className="font-semibold">{selectedVersion.title || "Untitled"}</h3>
										<p className="text-muted-foreground text-sm">
											{format(selectedVersion.createdAt, "PPpp")}
										</p>
									</div>

									<Separator />

									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground text-sm">Preview</span>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setPreviewMode(!previewMode)}
											>
												<Eye className="mr-1 h-4 w-4" />
												{previewMode ? "Hide" : "Show"} Full
											</Button>
										</div>
										<ScrollArea
											className={cn(
												"rounded-md border p-3",
												previewMode ? "h-[250px]" : "h-[100px]",
											)}
										>
											<p className="text-muted-foreground whitespace-pre-wrap text-sm">
												{getContentPreview(selectedVersion.content)}
											</p>
										</ScrollArea>
									</div>

									<div className="flex gap-2">
										<Button onClick={() => setRestoreDialogOpen(true)} className="flex-1">
											<RotateCcw className="mr-2 h-4 w-4" />
											Restore This Version
										</Button>
										<Button
											variant="outline"
											size="icon"
											onClick={() => handleDelete(selectedVersion._id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							) : (
								<div className="text-muted-foreground flex h-full items-center justify-center text-sm">
									Select a version to view details
								</div>
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Restore confirmation dialog */}
			<AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Restore Version</AlertDialogTitle>
						<AlertDialogDescription>
							This will restore the document to this version. A backup of the current version will
							be saved first. Are you sure you want to continue?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleRestore} disabled={isRestoring}>
							{isRestoring ? "Restoring..." : "Restore"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
