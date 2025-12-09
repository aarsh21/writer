import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { getAuthUserSafe } from "./auth"

// Helper to get authenticated user or throw
async function getAuthenticatedUser(ctx: MutationCtx) {
	const user = await getAuthUserSafe(ctx)
	if (!user) {
		throw new Error("Unauthorized: User not authenticated")
	}
	return user
}

// Role type
const roleValidator = v.union(v.literal("viewer"), v.literal("editor"), v.literal("owner"))

/**
 * Add a collaborator to a document
 * Only the owner can add collaborators
 */
export const addCollaborator = mutation({
	args: {
		documentId: v.id("documents"),
		userId: v.string(),
		role: roleValidator,
	},
	returns: v.id("documentCollaborators"),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		// Get the document and verify ownership
		const document = await ctx.db.get(args.documentId)
		if (!document || document.isDeleted) {
			throw new Error("Document not found")
		}

		if (document.ownerId !== user._id) {
			throw new Error("Only the owner can add collaborators")
		}

		// Can't add owner as collaborator (they already have access)
		if (args.userId === document.ownerId) {
			throw new Error("Cannot add the owner as a collaborator")
		}

		// Check if already a collaborator
		const existing = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.userId),
			)
			.unique()

		if (existing) {
			throw new Error("User is already a collaborator")
		}

		const collaboratorId = await ctx.db.insert("documentCollaborators", {
			documentId: args.documentId,
			userId: args.userId,
			role: args.role,
			addedAt: Date.now(),
		})

		return collaboratorId
	},
})

/**
 * Remove a collaborator from a document
 * Only the owner can remove collaborators
 */
export const removeCollaborator = mutation({
	args: {
		documentId: v.id("documents"),
		userId: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		// Get the document and verify ownership
		const document = await ctx.db.get(args.documentId)
		if (!document) {
			throw new Error("Document not found")
		}

		if (document.ownerId !== user._id) {
			throw new Error("Only the owner can remove collaborators")
		}

		// Find the collaborator entry
		const collaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.userId),
			)
			.unique()

		if (!collaborator) {
			throw new Error("Collaborator not found")
		}

		await ctx.db.delete(collaborator._id)

		// Also remove their presence data
		const presence = await ctx.db
			.query("userPresence")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.userId),
			)
			.unique()

		if (presence) {
			await ctx.db.delete(presence._id)
		}

		return null
	},
})

/**
 * Update a collaborator's role
 * Only the owner can update roles
 */
export const updateCollaboratorRole = mutation({
	args: {
		documentId: v.id("documents"),
		userId: v.string(),
		newRole: roleValidator,
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		// Get the document and verify ownership
		const document = await ctx.db.get(args.documentId)
		if (!document) {
			throw new Error("Document not found")
		}

		if (document.ownerId !== user._id) {
			throw new Error("Only the owner can update collaborator roles")
		}

		// Find the collaborator entry
		const collaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.userId),
			)
			.unique()

		if (!collaborator) {
			throw new Error("Collaborator not found")
		}

		await ctx.db.patch(collaborator._id, {
			role: args.newRole,
		})

		return null
	},
})

/**
 * List all collaborators for a document
 */
export const listCollaborators = query({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.array(
		v.object({
			_id: v.id("documentCollaborators"),
			documentId: v.id("documents"),
			userId: v.string(),
			role: roleValidator,
			addedAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return []

		// Verify user has access to the document
		const document = await ctx.db.get(args.documentId)
		if (!document || document.isDeleted) return []

		const isOwner = document.ownerId === user._id
		const isCollaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (!isOwner && !isCollaborator) return []

		const collaborators = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()

		// Map to exclude _creationTime
		return collaborators.map((c) => ({
			_id: c._id,
			documentId: c.documentId,
			userId: c.userId,
			role: c.role,
			addedAt: c.addedAt,
		}))
	},
})

/**
 * Get documents shared with the current user
 */
export const getSharedDocuments = query({
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
			role: roleValidator,
		}),
	),
	handler: async (ctx) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return []

		const collaborations = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect()

		const documents = await Promise.all(
			collaborations.map(async (collab) => {
				const doc = await ctx.db.get(collab.documentId)
				if (!doc || doc.isDeleted) return null
				return {
					...doc,
					role: collab.role,
				}
			}),
		)

		return documents.filter((doc): doc is NonNullable<typeof doc> => doc !== null)
	},
})

/**
 * Leave a document (remove self as collaborator)
 */
export const leaveDocument = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		// Find the collaborator entry
		const collaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (!collaborator) {
			throw new Error("You are not a collaborator on this document")
		}

		await ctx.db.delete(collaborator._id)

		// Also remove presence data
		const presence = await ctx.db
			.query("userPresence")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (presence) {
			await ctx.db.delete(presence._id)
		}

		return null
	},
})

/**
 * Check user's access level to a document
 */
export const checkAccess = query({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.union(
		v.object({
			hasAccess: v.literal(true),
			role: roleValidator,
			isOwner: v.boolean(),
		}),
		v.object({
			hasAccess: v.literal(false),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) {
			return { hasAccess: false as const }
		}

		const document = await ctx.db.get(args.documentId)
		if (!document || document.isDeleted) {
			return { hasAccess: false as const }
		}

		if (document.ownerId === user._id) {
			return { hasAccess: true as const, role: "owner" as const, isOwner: true }
		}

		const collaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (collaborator) {
			return {
				hasAccess: true as const,
				role: collaborator.role,
				isOwner: false,
			}
		}

		return { hasAccess: false as const }
	},
})

/**
 * Transfer document ownership to another user
 */
export const transferOwnership = mutation({
	args: {
		documentId: v.id("documents"),
		newOwnerId: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const document = await ctx.db.get(args.documentId)
		if (!document) {
			throw new Error("Document not found")
		}

		if (document.ownerId !== user._id) {
			throw new Error("Only the owner can transfer ownership")
		}

		if (args.newOwnerId === user._id) {
			throw new Error("You are already the owner")
		}

		// Remove new owner from collaborators if they are one
		const existingCollab = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.newOwnerId),
			)
			.unique()

		if (existingCollab) {
			await ctx.db.delete(existingCollab._id)
		}

		// Add old owner as editor collaborator
		await ctx.db.insert("documentCollaborators", {
			documentId: args.documentId,
			userId: user._id,
			role: "editor",
			addedAt: Date.now(),
		})

		// Transfer ownership
		await ctx.db.patch(args.documentId, {
			ownerId: args.newOwnerId,
			updatedAt: Date.now(),
		})

		return null
	},
})
