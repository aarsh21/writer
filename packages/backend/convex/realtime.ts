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

export const subscribeToDocument = query({
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

export const updateDocumentContent = mutation({
	args: {
		documentId: v.id("documents"),
		content: v.string(),
	},
	returns: v.object({
		success: v.boolean(),
		updatedAt: v.number(),
	}),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)
		await checkDocumentAccess(ctx, args.documentId, user._id, "editor")

		const now = Date.now()
		await ctx.db.patch("documents", args.documentId, {
			content: args.content,
			updatedAt: now,
		})

		return { success: true, updatedAt: now }
	},
})

export const updateDocumentTitle = mutation({
	args: {
		documentId: v.id("documents"),
		title: v.string(),
	},
	returns: v.object({
		success: v.boolean(),
		updatedAt: v.number(),
	}),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)
		await checkDocumentAccess(ctx, args.documentId, user._id, "editor")

		const now = Date.now()
		await ctx.db.patch("documents", args.documentId, {
			title: args.title,
			updatedAt: now,
		})

		return { success: true, updatedAt: now }
	},
})

export const batchUpdateDocument = mutation({
	args: {
		documentId: v.id("documents"),
		title: v.optional(v.string()),
		content: v.optional(v.string()),
	},
	returns: v.object({
		success: v.boolean(),
		updatedAt: v.number(),
	}),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)
		await checkDocumentAccess(ctx, args.documentId, user._id, "editor")

		const now = Date.now()
		const updates: Record<string, unknown> = { updatedAt: now }
		if (args.title !== undefined) updates.title = args.title
		if (args.content !== undefined) updates.content = args.content

		await ctx.db.patch("documents", args.documentId, updates)

		return { success: true, updatedAt: now }
	},
})

export const getDocumentMetadata = query({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.union(
		v.object({
			_id: v.id("documents"),
			title: v.string(),
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

		return {
			_id: document._id,
			title: document.title,
			ownerId: document.ownerId,
			createdAt: document.createdAt,
			updatedAt: document.updatedAt,
			isDeleted: document.isDeleted,
			parentFolderId: document.parentFolderId,
		}
	},
})

export const checkDocumentVersion = query({
	args: {
		documentId: v.id("documents"),
		lastKnownUpdate: v.number(),
	},
	returns: v.object({
		hasChanged: v.boolean(),
		currentUpdatedAt: v.number(),
	}),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return { hasChanged: false, currentUpdatedAt: 0 }

		const document = await ctx.db.get("documents", args.documentId)
		if (!document) return { hasChanged: false, currentUpdatedAt: 0 }

		return {
			hasChanged: document.updatedAt > args.lastKnownUpdate,
			currentUpdatedAt: document.updatedAt,
		}
	},
})
