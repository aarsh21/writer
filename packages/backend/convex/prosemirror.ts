import { ProsemirrorSync } from "@convex-dev/prosemirror-sync"

import { components } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

import { getAuthUserSafe } from "./auth"

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync)

/**
 * Validates and casts a string to a document ID.
 * Ensures the string is a valid Convex ID for the "documents" table.
 * Throws an error if the ID format is invalid.
 */
function validateDocumentId(id: string): Id<"documents"> {
	if (!id || typeof id !== "string" || id.trim() === "") {
		throw new Error("Invalid document ID: must be a non-empty string")
	}

	if (!/^[a-z0-9]{32}$/.test(id)) {
		throw new Error(`Invalid document ID format: ${id}`)
	}

	return id as Id<"documents">
}

async function checkRead(ctx: QueryCtx, id: string): Promise<void> {
	const documentId = validateDocumentId(id)
	const user = await getAuthUserSafe(ctx)
	if (!user) throw new Error("Unauthorized: User not authenticated")

	const document = await ctx.db.get("documents", documentId)
	if (!document || document.isDeleted) throw new Error("Document not found")

	if (document.ownerId === user._id) return

	const collaborator = await ctx.db
		.query("documentCollaborators")
		.withIndex("by_document_user", (q) => q.eq("documentId", documentId).eq("userId", user._id))
		.unique()

	if (!collaborator) throw new Error("Access denied: You don't have access to this document")
}

async function checkWrite(ctx: MutationCtx, id: string): Promise<void> {
	const documentId = validateDocumentId(id)
	const user = await getAuthUserSafe(ctx)
	if (!user) throw new Error("Unauthorized: User not authenticated")

	const document = await ctx.db.get("documents", documentId)
	if (!document || document.isDeleted) throw new Error("Document not found")

	if (document.ownerId === user._id) return

	const collaborator = await ctx.db
		.query("documentCollaborators")
		.withIndex("by_document_user", (q) => q.eq("documentId", documentId).eq("userId", user._id))
		.unique()

	if (!collaborator) throw new Error("Access denied: You don't have access to this document")

	if (collaborator.role === "viewer") {
		throw new Error("Access denied: Editor role required")
	}
}

async function onSnapshot(
	ctx: MutationCtx,
	id: string,
	snapshot: string,
	version: number,
): Promise<void> {
	try {
		const documentId = validateDocumentId(id)

		await ctx.db.patch("documents", documentId, {
			content: snapshot,
			updatedAt: Date.now(),
		})
	} catch (error) {
		console.error("Error in onSnapshot:", error)
	}
}

export const { getSnapshot, submitSnapshot, latestVersion, getSteps, submitSteps } =
	prosemirrorSync.syncApi({
		checkRead,
		checkWrite,
		onSnapshot,
	})
