import { ConvexError, v } from "convex/values"

import { mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"

import { getAuthUserSafe } from "./auth"
import { components } from "./_generated/api"

async function getAuthenticatedUser(ctx: MutationCtx) {
	const user = await getAuthUserSafe(ctx)
	if (!user) {
		throw new ConvexError({
			code: "UNAUTHORIZED",
			message: "Unauthorized: User not authenticated",
		})
	}
	return user
}

const roleValidator = v.union(v.literal("viewer"), v.literal("editor"), v.literal("owner"))

export const addCollaborator = mutation({
	args: {
		documentId: v.id("documents"),
		userId: v.string(),
		role: roleValidator,
	},
	returns: v.id("documentCollaborators"),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const document = await ctx.db.get("documents", args.documentId)
		if (!document || document.isDeleted) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Document not found",
			})
		}
		if (document.ownerId !== user._id) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Only the owner can add collaborators",
			})
		}
		if (args.userId === document.ownerId) {
			throw new ConvexError({
				code: "VALIDATION_ERROR",
				message: "Cannot add the owner as a collaborator",
			})
		}

		const existing = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.userId),
			)
			.unique()

		if (existing) {
			throw new ConvexError({
				code: "CONFLICT",
				message: "User is already a collaborator",
			})
		}

		return ctx.db.insert("documentCollaborators", {
			documentId: args.documentId,
			userId: args.userId,
			role: args.role,
			addedAt: Date.now(),
		})
	},
})

export const addCollaboratorByUsername = mutation({
	args: {
		documentId: v.id("documents"),
		username: v.string(),
		role: roleValidator,
	},
	returns: v.id("documentCollaborators"),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const document = await ctx.db.get("documents", args.documentId)
		if (!document || document.isDeleted) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Document not found",
			})
		}
		if (document.ownerId !== user._id) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Only the owner can add collaborators",
			})
		}

		const normalizedUsername = args.username.trim().toLowerCase()
		if (!normalizedUsername) {
			throw new ConvexError({
				code: "VALIDATION_ERROR",
				message: "Username is required",
			})
		}

		const targetUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
			model: "user",
			where: [{ field: "username", operator: "eq", value: normalizedUsername }],
		})

		if (!targetUser) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "User not found",
			})
		}
		if (targetUser._id === document.ownerId) {
			throw new ConvexError({
				code: "VALIDATION_ERROR",
				message: "Cannot add the owner as a collaborator",
			})
		}

		const existing = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", targetUser._id),
			)
			.unique()

		if (existing) {
			throw new ConvexError({
				code: "CONFLICT",
				message: "User is already a collaborator",
			})
		}

		return ctx.db.insert("documentCollaborators", {
			documentId: args.documentId,
			userId: targetUser._id,
			role: args.role,
			addedAt: Date.now(),
		})
	},
})

export const removeCollaborator = mutation({
	args: {
		documentId: v.id("documents"),
		userId: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const document = await ctx.db.get("documents", args.documentId)
		if (!document) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Document not found",
			})
		}
		if (document.ownerId !== user._id) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Only the owner can remove collaborators",
			})
		}

		const collaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.userId),
			)
			.unique()

		if (!collaborator) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Collaborator not found",
			})
		}

		await ctx.db.delete("documentCollaborators", collaborator._id)

		const presence = await ctx.db
			.query("userPresence")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.userId),
			)
			.unique()

		if (presence) await ctx.db.delete("userPresence", presence._id)

		return null
	},
})

export const updateCollaboratorRole = mutation({
	args: {
		documentId: v.id("documents"),
		userId: v.string(),
		newRole: roleValidator,
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const document = await ctx.db.get("documents", args.documentId)
		if (!document) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Document not found",
			})
		}
		if (document.ownerId !== user._id) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Only the owner can update collaborator roles",
			})
		}

		const collaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.userId),
			)
			.unique()

		if (!collaborator) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Collaborator not found",
			})
		}

		await ctx.db.patch("documentCollaborators", collaborator._id, { role: args.newRole })

		return null
	},
})

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

		const document = await ctx.db.get("documents", args.documentId)
		if (!document || document.isDeleted) return []

		const isOwner = document.ownerId === user._id
		const existing = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (!isOwner && !existing) return []

		const collaborators = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()

		return collaborators.map((c) => ({
			_id: c._id,
			documentId: c.documentId,
			userId: c.userId,
			role: c.role,
			addedAt: c.addedAt,
		}))
	},
})

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
				const doc = await ctx.db.get("documents", collab.documentId)
				if (!doc || doc.isDeleted) return null
				return { ...doc, role: collab.role }
			}),
		)

		return documents.filter((doc): doc is NonNullable<typeof doc> => doc !== null)
	},
})

export const leaveDocument = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const collaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (!collaborator) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "You are not a collaborator on this document",
			})
		}

		await ctx.db.delete("documentCollaborators", collaborator._id)

		const presence = await ctx.db
			.query("userPresence")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (presence) await ctx.db.delete("userPresence", presence._id)

		return null
	},
})

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
		if (!user) return { hasAccess: false as const }

		const document = await ctx.db.get("documents", args.documentId)
		if (!document || document.isDeleted) return { hasAccess: false as const }

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
			return { hasAccess: true as const, role: collaborator.role, isOwner: false }
		}

		return { hasAccess: false as const }
	},
})

export const transferOwnership = mutation({
	args: {
		documentId: v.id("documents"),
		newOwnerId: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const document = await ctx.db.get("documents", args.documentId)
		if (!document) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Document not found",
			})
		}
		if (document.ownerId !== user._id) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Only the owner can transfer ownership",
			})
		}
		if (args.newOwnerId === user._id) {
			throw new ConvexError({
				code: "VALIDATION_ERROR",
				message: "You are already the owner",
			})
		}

		const existing = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", args.newOwnerId),
			)
			.unique()

		if (existing) await ctx.db.delete("documentCollaborators", existing._id)

		await ctx.db.insert("documentCollaborators", {
			documentId: args.documentId,
			userId: user._id,
			role: "editor",
			addedAt: Date.now(),
		})

		await ctx.db.patch("documents", args.documentId, {
			ownerId: args.newOwnerId,
			updatedAt: Date.now(),
		})

		return null
	},
})
