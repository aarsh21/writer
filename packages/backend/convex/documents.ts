import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { getAuthUserSafe } from "./auth"
import type { Id } from "./_generated/dataModel"

// Helper to get authenticated user or throw (for mutations)
async function getAuthenticatedUser(ctx: MutationCtx) {
	const user = await getAuthUserSafe(ctx)
	if (!user) {
		throw new Error("Unauthorized: User not authenticated")
	}
	return user
}

// Helper to check document access
async function checkDocumentAccess(
	ctx: QueryCtx | MutationCtx,
	documentId: Id<"documents">,
	userId: string,
	requiredRole: "viewer" | "editor" | "owner" = "viewer",
) {
	const document = await ctx.db.get(documentId)
	if (!document || document.isDeleted) {
		throw new Error("Document not found")
	}

	// Owner always has access
	if (document.ownerId === userId) {
		return { document, role: "owner" as const }
	}

	// Check collaborator access
	const collaborator = await ctx.db
		.query("documentCollaborators")
		.withIndex("by_document_user", (q) => q.eq("documentId", documentId).eq("userId", userId))
		.unique()

	if (!collaborator) {
		throw new Error("Access denied: You don't have access to this document")
	}

	const roleHierarchy: Record<string, number> = {
		viewer: 0,
		editor: 1,
		owner: 2,
	}
	if (roleHierarchy[collaborator.role] < roleHierarchy[requiredRole]) {
		throw new Error(`Access denied: ${requiredRole} role required`)
	}

	return { document, role: collaborator.role }
}

// ============ CREATE OPERATIONS ============

export const createDocument = mutation({
	args: {
		title: v.optional(v.string()),
		content: v.optional(v.string()),
		parentFolderId: v.optional(v.id("folders")),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const now = Date.now()
		const documentId = await ctx.db.insert("documents", {
			title: args.title || "Untitled Document",
			content: args.content || JSON.stringify({ type: "doc", content: [] }),
			ownerId: user._id,
			createdAt: now,
			updatedAt: now,
			isDeleted: false,
			parentFolderId: args.parentFolderId,
		})

		return documentId
	},
})

// ============ READ OPERATIONS ============

export const getDocument = query({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.union(
		v.object({
			_id: v.id("documents"),
			_creationTime: v.number(),
			title: v.string(),
			content: v.string(),
			ownerId: v.string(),
			createdAt: v.number(),
			updatedAt: v.number(),
			isDeleted: v.boolean(),
			parentFolderId: v.optional(v.id("folders")),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return null

		try {
			const { document } = await checkDocumentAccess(ctx, args.documentId, user._id)
			return document
		} catch {
			return null
		}
	},
})

export const listDocuments = query({
	args: {
		folderId: v.optional(v.id("folders")),
		includeDeleted: v.optional(v.boolean()),
	},
	returns: v.array(
		v.object({
			_id: v.id("documents"),
			_creationTime: v.number(),
			title: v.string(),
			content: v.string(),
			ownerId: v.string(),
			createdAt: v.number(),
			updatedAt: v.number(),
			isDeleted: v.boolean(),
			parentFolderId: v.optional(v.id("folders")),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return []

		// Get owned documents
		let ownedDocs = await ctx.db
			.query("documents")
			.withIndex("by_owner", (q) => q.eq("ownerId", user._id))
			.collect()

		// Filter by folder if specified
		if (args.folderId !== undefined) {
			ownedDocs = ownedDocs.filter((doc) => doc.parentFolderId === args.folderId)
		}

		// Filter deleted documents unless explicitly requested
		if (!args.includeDeleted) {
			ownedDocs = ownedDocs.filter((doc) => !doc.isDeleted)
		}

		// Get shared documents
		const collaborations = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect()

		const sharedDocIds = collaborations.map((c) => c.documentId)
		const sharedDocs = await Promise.all(sharedDocIds.map((id) => ctx.db.get(id)))

		let validSharedDocs = sharedDocs.filter(
			(doc): doc is NonNullable<typeof doc> =>
				doc !== null && (!doc.isDeleted || args.includeDeleted === true),
		)

		// Filter shared docs by folder if specified
		if (args.folderId !== undefined) {
			validSharedDocs = validSharedDocs.filter((doc) => doc.parentFolderId === args.folderId)
		}

		// Combine and sort by updatedAt
		const allDocs = [...ownedDocs, ...validSharedDocs]
		allDocs.sort((a, b) => b.updatedAt - a.updatedAt)

		return allDocs
	},
})

export const searchDocuments = query({
	args: {
		searchQuery: v.string(),
	},
	returns: v.array(
		v.object({
			_id: v.id("documents"),
			_creationTime: v.number(),
			title: v.string(),
			content: v.string(),
			ownerId: v.string(),
			createdAt: v.number(),
			updatedAt: v.number(),
			isDeleted: v.boolean(),
			parentFolderId: v.optional(v.id("folders")),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user || !args.searchQuery.trim()) return []

		const results = await ctx.db
			.query("documents")
			.withSearchIndex("search_title", (q) =>
				q.search("title", args.searchQuery).eq("ownerId", user._id).eq("isDeleted", false),
			)
			.take(20)

		return results
	},
})

export const getRecentDocuments = query({
	args: {
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			_id: v.id("documents"),
			_creationTime: v.number(),
			title: v.string(),
			content: v.string(),
			ownerId: v.string(),
			createdAt: v.number(),
			updatedAt: v.number(),
			isDeleted: v.boolean(),
			parentFolderId: v.optional(v.id("folders")),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return []

		const limit = args.limit || 10

		const documents = await ctx.db
			.query("documents")
			.withIndex("by_owner_deleted", (q) => q.eq("ownerId", user._id).eq("isDeleted", false))
			.order("desc")
			.take(limit)

		return documents
	},
})

// ============ UPDATE OPERATIONS ============

export const updateDocument = mutation({
	args: {
		documentId: v.id("documents"),
		title: v.optional(v.string()),
		content: v.optional(v.string()),
		parentFolderId: v.optional(v.id("folders")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		await checkDocumentAccess(ctx, args.documentId, user._id, "editor")

		const updates: Record<string, unknown> = {
			updatedAt: Date.now(),
		}

		if (args.title !== undefined) updates.title = args.title
		if (args.content !== undefined) updates.content = args.content
		if (args.parentFolderId !== undefined) updates.parentFolderId = args.parentFolderId

		await ctx.db.patch(args.documentId, updates)
		return null
	},
})

export const renameDocument = mutation({
	args: {
		documentId: v.id("documents"),
		title: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		await checkDocumentAccess(ctx, args.documentId, user._id, "editor")

		await ctx.db.patch(args.documentId, {
			title: args.title,
			updatedAt: Date.now(),
		})
		return null
	},
})

// ============ DELETE OPERATIONS ============

export const deleteDocument = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		await checkDocumentAccess(ctx, args.documentId, user._id, "owner")

		// Soft delete
		await ctx.db.patch(args.documentId, {
			isDeleted: true,
			updatedAt: Date.now(),
		})
		return null
	},
})

export const restoreDocument = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const document = await ctx.db.get(args.documentId)
		if (!document) {
			throw new Error("Document not found")
		}

		if (document.ownerId !== user._id) {
			throw new Error("Only the owner can restore a document")
		}

		await ctx.db.patch(args.documentId, {
			isDeleted: false,
			updatedAt: Date.now(),
		})
		return null
	},
})

export const permanentlyDeleteDocument = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const document = await ctx.db.get(args.documentId)
		if (!document) {
			throw new Error("Document not found")
		}

		if (document.ownerId !== user._id) {
			throw new Error("Only the owner can permanently delete a document")
		}

		// Delete all collaborators
		const collaborators = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()

		for (const collab of collaborators) {
			await ctx.db.delete(collab._id)
		}

		// Delete all versions
		const versions = await ctx.db
			.query("documentVersions")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()

		for (const version of versions) {
			await ctx.db.delete(version._id)
		}

		// Delete presence data
		const presenceData = await ctx.db
			.query("userPresence")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()

		for (const presence of presenceData) {
			await ctx.db.delete(presence._id)
		}

		// Delete analytics
		const analytics = await ctx.db
			.query("documentAnalytics")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()

		for (const analytic of analytics) {
			await ctx.db.delete(analytic._id)
		}

		// Finally delete the document
		await ctx.db.delete(args.documentId)
		return null
	},
})

// ============ DUPLICATE OPERATION ============

export const duplicateDocument = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const { document } = await checkDocumentAccess(ctx, args.documentId, user._id)

		const now = Date.now()
		const newDocumentId = await ctx.db.insert("documents", {
			title: `${document.title} (Copy)`,
			content: document.content,
			ownerId: user._id,
			createdAt: now,
			updatedAt: now,
			isDeleted: false,
			parentFolderId: document.parentFolderId,
		})

		return newDocumentId
	},
})

// ============ MOVE OPERATION ============

export const moveDocument = mutation({
	args: {
		documentId: v.id("documents"),
		targetFolderId: v.optional(v.id("folders")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		await checkDocumentAccess(ctx, args.documentId, user._id, "editor")

		// Verify target folder exists and user owns it
		if (args.targetFolderId) {
			const folder = await ctx.db.get(args.targetFolderId)
			if (!folder || folder.ownerId !== user._id) {
				throw new Error("Target folder not found or access denied")
			}
		}

		await ctx.db.patch(args.documentId, {
			parentFolderId: args.targetFolderId,
			updatedAt: Date.now(),
		})
		return null
	},
})
