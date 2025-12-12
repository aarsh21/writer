import { v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"

import { getAuthUserSafe } from "./auth"

async function getAuthenticatedUser(ctx: MutationCtx) {
	const user = await getAuthUserSafe(ctx)
	if (!user) throw new Error("Unauthorized: User not authenticated")
	return user
}

async function checkDocumentAccess(
	ctx: QueryCtx | MutationCtx,
	documentId: Id<"documents">,
	userId: string,
	requiredRole: "viewer" | "editor" | "owner" = "viewer",
) {
	const document = await ctx.db.get("documents", documentId)
	if (!document || document.isDeleted) throw new Error("Document not found")

	if (document.ownerId === userId) return { document, role: "owner" as const }

	const collaborator = await ctx.db
		.query("documentCollaborators")
		.withIndex("by_document_user", (q) => q.eq("documentId", documentId).eq("userId", userId))
		.unique()

	if (!collaborator) throw new Error("Access denied: You don't have access to this document")

	const roleHierarchy: Record<string, number> = { viewer: 0, editor: 1, owner: 2 }
	if (roleHierarchy[collaborator.role] < roleHierarchy[requiredRole]) {
		throw new Error(`Access denied: ${requiredRole} role required`)
	}

	return { document, role: collaborator.role }
}

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

		// Generate smart default title if not provided
		let title = args.title
		if (!title) {
			const date = new Date(now)
			const month = date.toLocaleString("en-US", { month: "short" })
			const day = date.getDate()
			const year = date.getFullYear()

			// Count existing documents created today to make unique names
			const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
			const todayDocs = await ctx.db
				.query("documents")
				.withIndex("by_owner", (q) => q.eq("ownerId", user._id))
				.filter((q) => q.gte(q.field("createdAt"), startOfDay))
				.collect()

			const count = todayDocs.length + 1
			title = count === 1 ? `${month} ${day}, ${year}` : `${month} ${day}, ${year} (${count})`
		}

		return ctx.db.insert("documents", {
			title,
			content: args.content ?? JSON.stringify({ type: "doc", content: [] }),
			ownerId: user._id,
			createdAt: now,
			updatedAt: now,
			isDeleted: false,
			parentFolderId: args.parentFolderId,
		})
	},
})

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

		const document = await ctx.db.get("documents", args.documentId)
		if (!document || document.isDeleted) return null

		const isOwner = document.ownerId === user._id
		const collaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (!isOwner && !collaborator) return null

		return document
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

		const owned = await ctx.db
			.query("documents")
			.withIndex("by_owner", (q) => q.eq("ownerId", user._id))
			.collect()

		const filteredOwned = owned
			.filter((doc) => args.folderId === undefined || doc.parentFolderId === args.folderId)
			.filter((doc) => args.includeDeleted || !doc.isDeleted)

		const collaborations = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect()

		const shared = await Promise.all(
			collaborations.map((c) => ctx.db.get("documents", c.documentId)),
		)

		const filteredShared = shared
			.filter((doc): doc is NonNullable<typeof doc> => doc !== null)
			.filter((doc) => args.includeDeleted || !doc.isDeleted)
			.filter((doc) => args.folderId === undefined || doc.parentFolderId === args.folderId)

		const all = [...filteredOwned, ...filteredShared]
		all.sort((a, b) => b.updatedAt - a.updatedAt)

		return all
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

		return ctx.db
			.query("documents")
			.withSearchIndex("search_title", (q) =>
				q.search("title", args.searchQuery).eq("ownerId", user._id).eq("isDeleted", false),
			)
			.take(20)
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

		const count = args.limit ?? 10

		return ctx.db
			.query("documents")
			.withIndex("by_owner_deleted", (q) => q.eq("ownerId", user._id).eq("isDeleted", false))
			.order("desc")
			.take(count)
	},
})

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

		const updates: Record<string, unknown> = { updatedAt: Date.now() }
		if (args.title !== undefined) updates.title = args.title
		if (args.content !== undefined) updates.content = args.content
		if (args.parentFolderId !== undefined) updates.parentFolderId = args.parentFolderId

		await ctx.db.patch("documents", args.documentId, updates)
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

		await ctx.db.patch("documents", args.documentId, {
			title: args.title,
			updatedAt: Date.now(),
		})
		return null
	},
})

export const deleteDocument = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)
		await checkDocumentAccess(ctx, args.documentId, user._id, "owner")

		await ctx.db.patch("documents", args.documentId, {
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

		const document = await ctx.db.get("documents", args.documentId)
		if (!document) throw new Error("Document not found")
		if (document.ownerId !== user._id) throw new Error("Only the owner can restore a document")

		await ctx.db.patch("documents", args.documentId, {
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

		const document = await ctx.db.get("documents", args.documentId)
		if (!document) throw new Error("Document not found")
		if (document.ownerId !== user._id)
			throw new Error("Only the owner can permanently delete a document")

		const collaborators = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()
		for (const collab of collaborators) {
			await ctx.db.delete("documentCollaborators", collab._id)
		}

		const versions = await ctx.db
			.query("documentVersions")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()
		for (const version of versions) {
			await ctx.db.delete("documentVersions", version._id)
		}

		const presence = await ctx.db
			.query("userPresence")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()
		for (const p of presence) {
			await ctx.db.delete("userPresence", p._id)
		}

		await ctx.db.delete("documents", args.documentId)
		return null
	},
})

export const duplicateDocument = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.id("documents"),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)
		const { document } = await checkDocumentAccess(ctx, args.documentId, user._id)
		const now = Date.now()

		return ctx.db.insert("documents", {
			title: `${document.title} (Copy)`,
			content: document.content,
			ownerId: user._id,
			createdAt: now,
			updatedAt: now,
			isDeleted: false,
			parentFolderId: document.parentFolderId,
		})
	},
})

export const moveDocument = mutation({
	args: {
		documentId: v.id("documents"),
		targetFolderId: v.optional(v.id("folders")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)
		await checkDocumentAccess(ctx, args.documentId, user._id, "editor")

		if (args.targetFolderId) {
			const folder = await ctx.db.get("folders", args.targetFolderId)
			if (!folder || folder.ownerId !== user._id) {
				throw new Error("Target folder not found or access denied")
			}
		}

		await ctx.db.patch("documents", args.documentId, {
			parentFolderId: args.targetFolderId,
			updatedAt: Date.now(),
		})
		return null
	},
})

export const getDeletedDocuments = query({
	args: {},
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
	handler: async (ctx) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return []

		return ctx.db
			.query("documents")
			.withIndex("by_owner_deleted", (q) => q.eq("ownerId", user._id).eq("isDeleted", true))
			.order("desc")
			.collect()
	},
})

export const emptyTrash = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const user = await getAuthenticatedUser(ctx)

		const deletedDocs = await ctx.db
			.query("documents")
			.withIndex("by_owner_deleted", (q) => q.eq("ownerId", user._id).eq("isDeleted", true))
			.collect()

		for (const doc of deletedDocs) {
			// Delete collaborators
			const collaborators = await ctx.db
				.query("documentCollaborators")
				.withIndex("by_document", (q) => q.eq("documentId", doc._id))
				.collect()
			for (const collab of collaborators) {
				await ctx.db.delete("documentCollaborators", collab._id)
			}

			// Delete versions
			const versions = await ctx.db
				.query("documentVersions")
				.withIndex("by_document", (q) => q.eq("documentId", doc._id))
				.collect()
			for (const version of versions) {
				await ctx.db.delete("documentVersions", version._id)
			}

			// Delete presence
			const presence = await ctx.db
				.query("userPresence")
				.withIndex("by_document", (q) => q.eq("documentId", doc._id))
				.collect()
			for (const p of presence) {
				await ctx.db.delete("userPresence", p._id)
			}

			// Delete the document
			await ctx.db.delete("documents", doc._id)
		}

		return null
	},
})
