import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import type { GenericId } from "convex/values"
import { useCallback, useEffect, useRef } from "react"

import { api } from "@writer/backend/convex/_generated/api"

import { DocumentHeader } from "@/components/documents/document-header"
import { Editor } from "@/components/editor/editor"
import { Toolbar } from "@/components/editor/toolbar"
import { Skeleton } from "@/components/ui/skeleton"

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
	const updateContent = useMutation(api.realtime.updateDocumentContent)
	const updateTitle = useMutation(api.realtime.updateDocumentTitle)
	const addToRecent = useMutation(api.userPreferences.addToRecentDocuments)
	const updatePresence = useMutation(api.presence.updatePresence)
	const removePresence = useMutation(api.presence.removePresence)

	// Track the last saved content to avoid unnecessary saves
	const lastSavedContent = useRef<string | null>(null)
	const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

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

	// Initialize lastSavedContent when document loads
	useEffect(() => {
		if (document && lastSavedContent.current === null) {
			lastSavedContent.current = document.content
		}
	}, [document])

	// Debounced content save
	const handleContentUpdate = useCallback(
		(content: string) => {
			// Clear any pending save
			if (saveTimeout.current) {
				clearTimeout(saveTimeout.current)
			}

			// Don't save if content hasn't changed
			if (content === lastSavedContent.current) {
				return
			}

			// Debounce save by 500ms
			saveTimeout.current = setTimeout(async () => {
				await updateContent({
					documentId: docId,
					content,
				})
				lastSavedContent.current = content
			}, 500)
		},
		[docId, updateContent],
	)

	// Title update (immediate, no debounce)
	const handleTitleUpdate = useCallback(
		async (title: string) => {
			await updateTitle({
				documentId: docId,
				title,
			})
		},
		[docId, updateTitle],
	)

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (saveTimeout.current) {
				clearTimeout(saveTimeout.current)
			}
		}
	}, [])

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
			/>
			<Toolbar />
			<div className="flex-1 overflow-hidden">
				<Editor initialContent={document.content} onUpdate={handleContentUpdate} />
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
