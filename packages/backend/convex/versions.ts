import { v } from "convex/values"
import { mutation, query, internalMutation } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { getAuthUserSafe } from "./auth"
import type { Id } from "./_generated/dataModel"

// Helper to get authenticated user or throw
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
) {
	const document = await ctx.db.get(documentId)
	if (!document || document.isDeleted) {
		throw new Error("Document not found")
	}

	if (document.ownerId === userId) {
		return { document, role: "owner" as const }
	}

	const collaborator = await ctx.db
		.query("documentCollaborators")
		.withIndex("by_document_user", (q) => q.eq("documentId", documentId).eq("userId", userId))
		.unique()

	if (!collaborator) {
		throw new Error("Access denied")
	}

	return { document, role: collaborator.role }
}

// Maximum versions to keep per document
const MAX_VERSIONS = 50

// Minimum time between auto-saves (5 minutes)
const MIN_VERSION_INTERVAL = 5 * 60 * 1000

/**
 * Create a new version snapshot
 */
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

		// Cleanup old versions if exceeding limit
		const allVersions = await ctx.db
			.query("documentVersions")
			.withIndex("by_document", (q: any) => q.eq("documentId", args.documentId))
			.collect()

		if (allVersions.length > MAX_VERSIONS) {
			// Sort by createdAt and delete oldest
			allVersions.sort((a: any, b: any) => a.createdAt - b.createdAt)
			const toDelete = allVersions.slice(0, allVersions.length - MAX_VERSIONS)
			for (const version of toDelete) {
				await ctx.db.delete(version._id)
			}
		}

		return versionId
	},
})

/**
 * Auto-create version if enough time has passed
 * Returns true if a version was created
 */
export const autoCreateVersion = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const { document } = await checkDocumentAccess(ctx, args.documentId, user._id)

		// Get the most recent version
		const versions = await ctx.db
			.query("documentVersions")
			.withIndex("by_document", (q: any) => q.eq("documentId", args.documentId))
			.collect()

		const latestVersion = versions.sort((a: any, b: any) => b.createdAt - a.createdAt)[0]

		const now = Date.now()

		// Only create if no versions exist or enough time has passed
		if (!latestVersion || now - latestVersion.createdAt >= MIN_VERSION_INTERVAL) {
			await ctx.db.insert("documentVersions", {
				documentId: args.documentId,
				content: document.content,
				title: document.title,
				createdAt: now,
				createdBy: user._id,
			})

			// Cleanup old versions
			if (versions.length >= MAX_VERSIONS) {
				const sortedVersions = versions.sort((a: any, b: any) => a.createdAt - b.createdAt)
				await ctx.db.delete(sortedVersions[0]._id)
			}

			return true
		}

		return false
	},
})

/**
 * List all versions for a document
 */
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

		try {
			await checkDocumentAccess(ctx, args.documentId, user._id)
		} catch {
			return []
		}

		const limit = args.limit || 20

		const versions = await ctx.db
			.query("documentVersions")
			.withIndex("by_document", (q: any) => q.eq("documentId", args.documentId))
			.collect()

		// Sort by createdAt descending and limit
		versions.sort((a: any, b: any) => b.createdAt - a.createdAt)
		return versions.slice(0, limit)
	},
})

/**
 * Get a specific version
 */
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

		const version = await ctx.db.get(args.versionId)
		if (!version) return null

		try {
			await checkDocumentAccess(ctx, version.documentId, user._id)
			return version
		} catch {
			return null
		}
	},
})

/**
 * Restore a document to a specific version
 */
export const restoreVersion = mutation({
	args: {
		versionId: v.id("documentVersions"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const version = await ctx.db.get(args.versionId)
		if (!version) {
			throw new Error("Version not found")
		}

		const { document } = await checkDocumentAccess(ctx, version.documentId, user._id)

		// Check if user has edit access
		if (document.ownerId !== user._id) {
			const collaborator = await ctx.db
				.query("documentCollaborators")
				.withIndex("by_document_user", (q: any) =>
					q.eq("documentId", version.documentId).eq("userId", user._id),
				)
				.unique()

			if (!collaborator || collaborator.role === "viewer") {
				throw new Error("Editor access required to restore versions")
			}
		}

		// Create a version of current state before restoring
		await ctx.db.insert("documentVersions", {
			documentId: version.documentId,
			content: document.content,
			title: document.title,
			createdAt: Date.now(),
			createdBy: user._id,
		})

		// Restore the document
		await ctx.db.patch(version.documentId, {
			content: version.content,
			title: version.title,
			updatedAt: Date.now(),
		})

		return null
	},
})

/**
 * Compare two versions
 */
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

		const [version1, version2] = await Promise.all([
			ctx.db.get(args.versionId1),
			ctx.db.get(args.versionId2),
		])

		if (!version1 || !version2) return null
		if (version1.documentId !== version2.documentId) return null

		try {
			await checkDocumentAccess(ctx, version1.documentId, user._id)
		} catch {
			return null
		}

		return {
			version1: {
				_id: version1._id,
				content: version1.content,
				title: version1.title,
				createdAt: version1.createdAt,
			},
			version2: {
				_id: version2._id,
				content: version2.content,
				title: version2.title,
				createdAt: version2.createdAt,
			},
		}
	},
})

/**
 * Delete a specific version
 * Only the document owner can delete versions
 */
export const deleteVersion = mutation({
	args: {
		versionId: v.id("documentVersions"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const version = await ctx.db.get(args.versionId)
		if (!version) {
			throw new Error("Version not found")
		}

		const document = await ctx.db.get(version.documentId)
		if (!document || document.ownerId !== user._id) {
			throw new Error("Only the document owner can delete versions")
		}

		await ctx.db.delete(args.versionId)

		return null
	},
})

/**
 * Get version count for a document
 */
export const getVersionCount = query({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return 0

		try {
			await checkDocumentAccess(ctx, args.documentId, user._id)
		} catch {
			return 0
		}

		const versions = await ctx.db
			.query("documentVersions")
			.withIndex("by_document", (q: any) => q.eq("documentId", args.documentId))
			.collect()

		return versions.length
	},
})

/**
 * Internal mutation to cleanup old versions across all documents
 * Can be scheduled as a cron job
 */
export const cleanupOldVersions = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const allVersions = await ctx.db.query("documentVersions").collect()

		// Group by document
		const versionsByDocument = new Map<Id<"documents">, any[]>()
		for (const version of allVersions) {
			const existing = versionsByDocument.get(version.documentId) || []
			existing.push(version)
			versionsByDocument.set(version.documentId, existing)
		}

		let deletedCount = 0

		// For each document, delete excess versions
		for (const [, versions] of versionsByDocument) {
			if (versions.length > MAX_VERSIONS) {
				versions.sort((a: any, b: any) => a.createdAt - b.createdAt)
				const toDelete = versions.slice(0, versions.length - MAX_VERSIONS)
				for (const version of toDelete) {
					await ctx.db.delete(version._id)
					deletedCount++
				}
			}
		}

		return deletedCount
	},
})
