import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { internalMutation, mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"

import { getAuthUserSafe } from "./auth"

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

async function checkDocumentAccess(
	ctx: QueryCtx | MutationCtx,
	documentId: Id<"documents">,
	userId: string,
) {
	const document = await ctx.db.get("documents", documentId)
	if (!document || document.isDeleted) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Document not found",
		})
	}

	if (document.ownerId === userId) return { document, role: "owner" as const }

	const collaborator = await ctx.db
		.query("documentCollaborators")
		.withIndex("by_document_user", (q) => q.eq("documentId", documentId).eq("userId", userId))
		.unique()

	if (!collaborator) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "Access denied",
		})
	}

	return { document, role: collaborator.role }
}

const MAX_VERSIONS = 50
const MIN_VERSION_INTERVAL = 5 * 60 * 1000

export const createVersion = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.id("documentVersions"),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)
		const { document } = await checkDocumentAccess(ctx, args.documentId, user._id)

		const versionId = await ctx.db.insert("documentVersions", {
			documentId: args.documentId,
			content: document.content,
			title: document.title,
			createdAt: Date.now(),
			createdBy: user._id,
		})

		const all = await ctx.db
			.query("documentVersions")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()

		if (all.length > MAX_VERSIONS) {
			const sorted = [...all].sort((a, b) => a.createdAt - b.createdAt)
			const toDelete = sorted.slice(0, all.length - MAX_VERSIONS)
			for (const version of toDelete) {
				await ctx.db.delete("documentVersions", version._id)
			}
		}

		return versionId
	},
})

export const autoCreateVersion = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)
		const { document } = await checkDocumentAccess(ctx, args.documentId, user._id)

		const versions = await ctx.db
			.query("documentVersions")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()

		const sorted = [...versions].sort((a, b) => b.createdAt - a.createdAt)
		const latest = sorted[0]
		const now = Date.now()

		if (!latest || now - latest.createdAt >= MIN_VERSION_INTERVAL) {
			await ctx.db.insert("documentVersions", {
				documentId: args.documentId,
				content: document.content,
				title: document.title,
				createdAt: now,
				createdBy: user._id,
			})

			if (versions.length >= MAX_VERSIONS) {
				const oldest = [...versions].sort((a, b) => a.createdAt - b.createdAt)[0]
				await ctx.db.delete("documentVersions", oldest._id)
			}

			return true
		}

		return false
	},
})

export const listVersions = query({
	args: {
		documentId: v.id("documents"),
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			_id: v.id("documentVersions"),
			_creationTime: v.number(),
			documentId: v.id("documents"),
			content: v.string(),
			title: v.string(),
			createdAt: v.number(),
			createdBy: v.string(),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return []

		const document = await ctx.db.get("documents", args.documentId)
		if (!document || document.isDeleted) return []

		const isOwner = document.ownerId === user._id
		const collaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (!isOwner && !collaborator) return []

		const count = args.limit ?? 20

		const versions = await ctx.db
			.query("documentVersions")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()

		const sorted = [...versions].sort((a, b) => b.createdAt - a.createdAt)
		return sorted.slice(0, count)
	},
})

export const getVersion = query({
	args: {
		versionId: v.id("documentVersions"),
	},
	returns: v.union(
		v.object({
			_id: v.id("documentVersions"),
			_creationTime: v.number(),
			documentId: v.id("documents"),
			content: v.string(),
			title: v.string(),
			createdAt: v.number(),
			createdBy: v.string(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return null

		const version = await ctx.db.get("documentVersions", args.versionId)
		if (!version) return null

		const document = await ctx.db.get("documents", version.documentId)
		if (!document || document.isDeleted) return null

		const isOwner = document.ownerId === user._id
		const collaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", version.documentId).eq("userId", user._id),
			)
			.unique()

		if (!isOwner && !collaborator) return null

		return version
	},
})

export const restoreVersion = mutation({
	args: {
		versionId: v.id("documentVersions"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const version = await ctx.db.get("documentVersions", args.versionId)
		if (!version) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Version not found",
			})
		}

		const { document } = await checkDocumentAccess(ctx, version.documentId, user._id)

		if (document.ownerId !== user._id) {
			const collaborator = await ctx.db
				.query("documentCollaborators")
				.withIndex("by_document_user", (q) =>
					q.eq("documentId", version.documentId).eq("userId", user._id),
				)
				.unique()

			if (!collaborator || collaborator.role === "viewer") {
				throw new ConvexError({
					code: "FORBIDDEN",
					message: "Editor access required to restore versions",
				})
			}
		}

		await ctx.db.insert("documentVersions", {
			documentId: version.documentId,
			content: document.content,
			title: document.title,
			createdAt: Date.now(),
			createdBy: user._id,
		})

		await ctx.db.patch("documents", version.documentId, {
			content: version.content,
			title: version.title,
			updatedAt: Date.now(),
		})

		return null
	},
})

export const compareVersions = query({
	args: {
		versionId1: v.id("documentVersions"),
		versionId2: v.id("documentVersions"),
	},
	returns: v.union(
		v.object({
			version1: v.object({
				_id: v.id("documentVersions"),
				content: v.string(),
				title: v.string(),
				createdAt: v.number(),
			}),
			version2: v.object({
				_id: v.id("documentVersions"),
				content: v.string(),
				title: v.string(),
				createdAt: v.number(),
			}),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return null

		const [v1, v2] = await Promise.all([
			ctx.db.get("documentVersions", args.versionId1),
			ctx.db.get("documentVersions", args.versionId2),
		])

		if (!v1 || !v2) return null
		if (v1.documentId !== v2.documentId) return null

		const document = await ctx.db.get("documents", v1.documentId)
		if (!document || document.isDeleted) return null

		const isOwner = document.ownerId === user._id
		const collaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", v1.documentId).eq("userId", user._id),
			)
			.unique()

		if (!isOwner && !collaborator) return null

		return {
			version1: {
				_id: v1._id,
				content: v1.content,
				title: v1.title,
				createdAt: v1.createdAt,
			},
			version2: {
				_id: v2._id,
				content: v2.content,
				title: v2.title,
				createdAt: v2.createdAt,
			},
		}
	},
})

export const deleteVersion = mutation({
	args: {
		versionId: v.id("documentVersions"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const version = await ctx.db.get("documentVersions", args.versionId)
		if (!version) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Version not found",
			})
		}

		const document = await ctx.db.get("documents", version.documentId)
		if (!document || document.ownerId !== user._id) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Only the document owner can delete versions",
			})
		}

		await ctx.db.delete("documentVersions", args.versionId)

		return null
	},
})

export const getVersionCount = query({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return 0

		const document = await ctx.db.get("documents", args.documentId)
		if (!document || document.isDeleted) return 0

		const isOwner = document.ownerId === user._id
		const collaborator = await ctx.db
			.query("documentCollaborators")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (!isOwner && !collaborator) return 0

		const versions = await ctx.db
			.query("documentVersions")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()

		return versions.length
	},
})

export const cleanupOldVersions = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const all = await ctx.db.query("documentVersions").collect()

		const byDocument = new Map<Id<"documents">, Doc<"documentVersions">[]>()
		for (const version of all) {
			const existing = byDocument.get(version.documentId) ?? []
			existing.push(version)
			byDocument.set(version.documentId, existing)
		}

		let deleted = 0

		for (const [, versions] of byDocument) {
			if (versions.length > MAX_VERSIONS) {
				const sorted = [...versions].sort((a, b) => a.createdAt - b.createdAt)
				const toDelete = sorted.slice(0, versions.length - MAX_VERSIONS)
				for (const version of toDelete) {
					await ctx.db.delete("documentVersions", version._id)
					deleted++
				}
			}
		}

		return deleted
	},
})
