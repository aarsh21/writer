import { ConvexError, v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"

import { getAuthUserSafe } from "./auth"
import { getAuthenticatedUser, checkFolderAccess } from "./lib/utils"

export const createFolder = mutation({
	args: {
		name: v.string(),
		parentId: v.optional(v.id("folders")),
	},
	returns: v.id("folders"),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		if (args.parentId) {
			const parent = await ctx.db.get("folders", args.parentId)
			if (!parent || parent.ownerId !== user._id) {
				throw new ConvexError({
					code: "NOT_FOUND",
					message: "Parent folder not found or access denied",
				})
			}
		}

		return ctx.db.insert("folders", {
			name: args.name,
			ownerId: user._id,
			parentId: args.parentId,
			createdAt: Date.now(),
		})
	},
})

export const renameFolder = mutation({
	args: {
		folderId: v.id("folders"),
		name: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const folder = await ctx.db.get("folders", args.folderId)
		if (!folder) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Folder not found",
			})
		}
		if (folder.ownerId !== user._id) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Access denied: You don't own this folder",
			})
		}

		await ctx.db.patch("folders", args.folderId, { name: args.name })
		return null
	},
})

export const deleteFolder = mutation({
	args: {
		folderId: v.id("folders"),
		deleteContents: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const folder = await ctx.db.get("folders", args.folderId)
		if (!folder) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Folder not found",
			})
		}
		if (folder.ownerId !== user._id) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Access denied: You don't own this folder",
			})
		}

		// Helper function to recursively delete folder contents
		async function deleteFolderRecursively(folderId: Id<"folders">) {
			// Get all documents in this folder
			const documents = await ctx.db
				.query("documents")
				.withIndex("by_folder", (q) => q.eq("parentFolderId", folderId))
				.collect()

			// Get all subfolders
			const subfolders = await ctx.db
				.query("folders")
				.withIndex("by_parent", (q) => q.eq("parentId", folderId))
				.collect()

			// Mark all documents as deleted (move to trash)
			for (const doc of documents) {
				await ctx.db.patch("documents", doc._id, {
					isDeleted: true,
					updatedAt: Date.now(),
				})
			}

			// Recursively delete all subfolders
			for (const subfolder of subfolders) {
				await deleteFolderRecursively(subfolder._id)
				await ctx.db.delete("folders", subfolder._id)
			}
		}

		if (args.deleteContents) {
			// Delete all contents recursively
			await deleteFolderRecursively(args.folderId)
		} else {
			// Move contents to parent folder
			const documents = await ctx.db
				.query("documents")
				.withIndex("by_folder", (q) => q.eq("parentFolderId", args.folderId))
				.collect()

			const subfolders = await ctx.db
				.query("folders")
				.withIndex("by_parent", (q) => q.eq("parentId", args.folderId))
				.collect()

			for (const doc of documents) {
				await ctx.db.patch("documents", doc._id, {
					parentFolderId: folder.parentId,
					updatedAt: Date.now(),
				})
			}

			for (const subfolder of subfolders) {
				await ctx.db.patch("folders", subfolder._id, {
					parentId: folder.parentId,
				})
			}
		}

		await ctx.db.delete("folders", args.folderId)
		return null
	},
})

export const moveFolder = mutation({
	args: {
		folderId: v.id("folders"),
		newParentId: v.optional(v.id("folders")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const folder = await ctx.db.get("folders", args.folderId)
		if (!folder) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Folder not found",
			})
		}
		if (folder.ownerId !== user._id) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Access denied: You don't own this folder",
			})
		}
		if (args.newParentId === args.folderId) {
			throw new ConvexError({
				code: "VALIDATION_ERROR",
				message: "Cannot move a folder into itself",
			})
		}

		if (args.newParentId) {
			let currentParent: Id<"folders"> | undefined = args.newParentId
			while (currentParent) {
				if (currentParent === args.folderId) {
					throw new ConvexError({
						code: "VALIDATION_ERROR",
						message: "Cannot move a folder into one of its subfolders",
					})
				}
				const parent: Doc<"folders"> | null = await ctx.db.get("folders", currentParent)
				currentParent = parent?.parentId
			}
		}

		await ctx.db.patch("folders", args.folderId, { parentId: args.newParentId })
		return null
	},
})

export const listFolders = query({
	args: {
		parentId: v.optional(v.id("folders")),
	},
	returns: v.array(
		v.object({
			_id: v.id("folders"),
			_creationTime: v.number(),
			name: v.string(),
			ownerId: v.string(),
			parentId: v.optional(v.id("folders")),
			createdAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return []

		let folders: Doc<"folders">[]

		if (args.parentId !== undefined) {
			folders = await ctx.db
				.query("folders")
				.withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
				.collect()
		} else {
			folders = await ctx.db
				.query("folders")
				.withIndex("by_owner", (q) => q.eq("ownerId", user._id))
				.collect()
			folders = folders.filter((f) => !f.parentId)
		}

		return folders.filter((f) => f.ownerId === user._id)
	},
})

export const getFolderContents = query({
	args: {
		folderId: v.optional(v.id("folders")),
	},
	returns: v.object({
		folders: v.array(
			v.object({
				_id: v.id("folders"),
				_creationTime: v.number(),
				name: v.string(),
				ownerId: v.string(),
				parentId: v.optional(v.id("folders")),
				createdAt: v.number(),
			}),
		),
		documents: v.array(
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
	}),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return { folders: [], documents: [] }

		let folders: Doc<"folders">[]
		if (args.folderId) {
			folders = await ctx.db
				.query("folders")
				.withIndex("by_parent", (q) => q.eq("parentId", args.folderId))
				.collect()
		} else {
			folders = await ctx.db
				.query("folders")
				.withIndex("by_owner", (q) => q.eq("ownerId", user._id))
				.collect()
			folders = folders.filter((f) => !f.parentId)
		}

		folders = folders.filter((f) => f.ownerId === user._id)

		let documents: Doc<"documents">[]
		if (args.folderId) {
			documents = await ctx.db
				.query("documents")
				.withIndex("by_folder", (q) => q.eq("parentFolderId", args.folderId))
				.collect()
		} else {
			documents = await ctx.db
				.query("documents")
				.withIndex("by_owner", (q) => q.eq("ownerId", user._id))
				.collect()
			documents = documents.filter((d) => !d.parentFolderId)
		}

		documents = documents.filter((d) => d.ownerId === user._id && !d.isDeleted)

		folders.sort((a, b) => a.name.localeCompare(b.name))
		documents.sort((a, b) => a.title.localeCompare(b.title))

		return { folders, documents }
	},
})

export const getFolder = query({
	args: {
		folderId: v.id("folders"),
	},
	returns: v.union(
		v.object({
			_id: v.id("folders"),
			_creationTime: v.number(),
			name: v.string(),
			ownerId: v.string(),
			parentId: v.optional(v.id("folders")),
			createdAt: v.number(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return null

		const folder = await ctx.db.get("folders", args.folderId)
		if (!folder || folder.ownerId !== user._id) return null

		return folder
	},
})

export const getFolderPath = query({
	args: {
		folderId: v.id("folders"),
	},
	returns: v.array(
		v.object({
			_id: v.id("folders"),
			name: v.string(),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return []

		const path: Array<{ _id: Id<"folders">; name: string }> = []
		let currentId: Id<"folders"> | undefined = args.folderId

		while (currentId) {
			const folder: Doc<"folders"> | null = await ctx.db.get("folders", currentId)
			if (!folder || folder.ownerId !== user._id) break
			path.unshift({ _id: folder._id, name: folder.name })
			currentId = folder.parentId
		}

		return path
	},
})
