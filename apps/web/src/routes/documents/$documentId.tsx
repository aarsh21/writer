import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import type { GenericId } from "convex/values"
import { useCallback, useEffect, useState } from "react"
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap"

import { api } from "@writer/backend/convex/_generated/api"

import { DocumentHeader } from "@/components/documents/document-header"
import { Editor } from "@/components/editor/editor"
import { Toolbar } from "@/components/editor/toolbar"
import { Skeleton } from "@/components/ui/skeleton"
import { useEditorStore } from "@/store/use-editor-store"

const PRESENCE_HEARTBEAT_INTERVAL = 10 * 1000 // 10 seconds
export const Route = createFileRoute("/documents/$documentId")({
	component: DocumentEditor,
})

// Use GenericId for document IDs
type DocumentId = GenericId<"documents">

function DocumentEditor() {
	const { documentId } = Route.useParams()
	const navigate = useNavigate()

	// Cast documentId to the expected type - Convex will validate
	const docId = documentId as DocumentId

	const document = useQuery(api.realtime.subscribeToDocument, { documentId: docId })
	const access = useQuery(api.collaborators.checkAccess, { documentId: docId })
	const updateTitle = useMutation(api.realtime.updateDocumentTitle)
	const addToRecent = useMutation(api.userPreferences.addToRecentDocuments)
	const updatePresence = useMutation(api.presence.updatePresence)
	const removePresence = useMutation(api.presence.removePresence)

	const canEdit = access?.hasAccess ? access.role !== "viewer" : false
	const setCanEdit = useEditorStore((state) => state.setCanEdit)
	const setSaveStatus = useEditorStore((state) => state.setSaveStatus)
	const [syncError, setSyncError] = useState<Error | null>(null)

	const sync = useTiptapSync(api.prosemirror, documentId as string, {
		snapshotDebounceMs: 1000,
		onSyncError: (error) => {
			console.error("Sync error:", error)
			setSyncError(error)
			setSaveStatus("error")
		},
	})

	useEffect(() => {
		setCanEdit(canEdit)
	}, [canEdit, setCanEdit])

	// Add to recent documents when viewing
	useEffect(() => {
		if (document) {
			addToRecent({ documentId: docId })
		}
	}, [document, addToRecent, docId])

	// Presence tracking - update presence on mount and periodically
	useEffect(() => {
		if (!document) return

		// Initial presence update
		updatePresence({ documentId: docId })

		// Set up heartbeat interval
		const heartbeatInterval = setInterval(() => {
			updatePresence({ documentId: docId })
		}, PRESENCE_HEARTBEAT_INTERVAL)

		// Cleanup: remove presence when leaving document
		return () => {
			clearInterval(heartbeatInterval)
			removePresence({ documentId: docId })
		}
	}, [docId, document, updatePresence, removePresence])

	const initializeSync = useCallback(() => {
		if (!document || !sync || sync.isLoading || sync.initialContent !== null) {
			return
		}

		try {
			const content = JSON.parse(document.content || '{"type":"doc","content":[]}')
			sync.create(content).catch((err) => {
				if (!err.message?.includes("already exists")) {
					console.error("Failed to create document:", err)
				}
			})
		} catch (error) {
			console.error("Invalid document content:", error)
		}
	}, [document, sync])

	useEffect(() => {
		initializeSync()
	}, [initializeSync])

	// Title update (immediate, no debounce)
	const handleTitleUpdate = useCallback(
		async (title: string) => {
			if (!canEdit) return

			await updateTitle({
				documentId: docId,
				title,
			})
		},
		[canEdit, docId, updateTitle],
	)

	useEffect(() => {
		if (sync?.isLoading) {
			setSaveStatus("pending")
		} else if (sync?.initialContent !== null) {
			setSaveStatus("saved")
			setSyncError(null)
		}
	}, [setSaveStatus, sync?.initialContent, sync?.isLoading])

	const handleRetrySync = useCallback(() => {
		setSyncError(null)
		window.location.reload()
	}, [])

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			setSaveStatus("idle")
		}
	}, [setSaveStatus])

	// Handle document not found
	if (document === null) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<h1 className="text-2xl font-semibold">Document not found</h1>
				<p className="text-muted-foreground">
					This document may have been deleted or you don't have access to it.
				</p>
				<button
					type="button"
					onClick={() => navigate({ to: "/" })}
					className="text-primary hover:underline"
				>
					Go back to dashboard
				</button>
			</div>
		)
	}

	// Loading state
	if (document === undefined) {
		return <DocumentSkeleton />
	}

	return (
		<div className="flex h-full flex-col overflow-hidden">
			<DocumentHeader
				documentId={docId}
				title={document.title}
				updatedAt={document.updatedAt}
				onTitleChange={handleTitleUpdate}
				canEdit={canEdit}
				syncStatus={{
					isLoading: sync.isLoading,
					error: syncError,
					onRetry: handleRetrySync,
				}}
			/>
			<Toolbar />
			<div className="flex-1 overflow-hidden">
				{sync.isLoading || sync.initialContent === null ? (
					<SyncLoadingState isInitializing={!sync.isLoading} />
				) : (
					<Editor
						initialContent={sync.initialContent}
						syncExtension={sync.extension}
						editable={canEdit}
					/>
				)}
			</div>
		</div>
	)
}

function DocumentSkeleton() {
	return (
		<div className="flex h-full flex-col">
			{/* Header skeleton */}
			<div className="border-border flex items-center gap-4 border-b px-4 py-3">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-4 w-32" />
			</div>
			{/* Toolbar skeleton */}
			<div className="border-border flex gap-2 border-b px-2 py-1.5">
				<Skeleton className="h-8 w-8" />
				<Skeleton className="h-8 w-8" />
				<Skeleton className="h-8 w-24" />
				<Skeleton className="h-8 w-8" />
				<Skeleton className="h-8 w-8" />
			</div>
			{/* Editor skeleton */}
			<div className="flex-1 p-8">
				<Skeleton className="mb-4 h-8 w-3/4" />
				<Skeleton className="mb-2 h-4 w-full" />
				<Skeleton className="mb-2 h-4 w-full" />
				<Skeleton className="mb-2 h-4 w-2/3" />
				<Skeleton className="mb-6 h-4 w-5/6" />
				<Skeleton className="mb-2 h-4 w-full" />
				<Skeleton className="h-4 w-1/2" />
			</div>
		</div>
	)
}

function SyncLoadingState({ isInitializing }: { isInitializing: boolean }) {
	return (
		<div className="bg-muted/30 flex h-full flex-col items-center justify-center gap-6 px-6">
			<div className="flex flex-col items-center gap-2">
				<Skeleton className="h-5 w-36" />
				<p className="text-muted-foreground text-sm">
					{isInitializing ? "Preparing real-time sync..." : "Connecting to sync..."}
				</p>
			</div>
			<div className="w-full max-w-3xl space-y-3">
				<Skeleton className="h-4 w-5/6" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-4/5" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		</div>
	)
}
