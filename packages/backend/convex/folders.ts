import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
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

/**
 * Create a new folder
 */
export const createFolder = mutation({
	args: {
		name: v.string(),
		parentId: v.optional(v.id("folders")),
	},
	returns: v.id("folders"),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		// If parentId is provided, verify it exists and user owns it
		if (args.parentId) {
			const parentFolder = await ctx.db.get(args.parentId)
			if (!parentFolder || parentFolder.ownerId !== user._id) {
				throw new Error("Parent folder not found or access denied")
			}
		}

		const folderId = await ctx.db.insert("folders", {
			name: args.name,
			ownerId: user._id,
			parentId: args.parentId,
			createdAt: Date.now(),
		})

		return folderId
	},
})

/**
 * Rename a folder
 */
export const renameFolder = mutation({
	args: {
		folderId: v.id("folders"),
		name: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const folder = await ctx.db.get(args.folderId)
		if (!folder) {
			throw new Error("Folder not found")
		}

		if (folder.ownerId !== user._id) {
			throw new Error("Access denied: You don't own this folder")
		}

		await ctx.db.patch(args.folderId, {
			name: args.name,
		})

		return null
	},
})

/**
 * Delete a folder and optionally its contents
 */
export const deleteFolder = mutation({
	args: {
		folderId: v.id("folders"),
		deleteContents: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const folder = await ctx.db.get(args.folderId)
		if (!folder) {
			throw new Error("Folder not found")
		}

		if (folder.ownerId !== user._id) {
			throw new Error("Access denied: You don't own this folder")
		}

		// Get all documents in this folder
		const documents = await ctx.db
			.query("documents")
			.withIndex("by_folder", (q: any) => q.eq("parentFolderId", args.folderId))
			.collect()

		// Get all subfolders
		const subfolders = await ctx.db
			.query("folders")
			.withIndex("by_parent", (q: any) => q.eq("parentId", args.folderId))
			.collect()

		if (documents.length > 0 || subfolders.length > 0) {
			if (args.deleteContents) {
				// Soft delete all documents
				for (const doc of documents) {
					await ctx.db.patch(doc._id, {
						isDeleted: true,
						updatedAt: Date.now(),
					})
				}

				// Recursively delete subfolders (move their contents to parent)
				for (const subfolder of subfolders) {
					// Move subfolder documents to current folder's parent
					const subDocs = await ctx.db
						.query("documents")
						.withIndex("by_folder", (q: any) => q.eq("parentFolderId", subfolder._id))
						.collect()

					for (const subDoc of subDocs) {
						await ctx.db.patch(subDoc._id, {
							parentFolderId: folder.parentId,
							updatedAt: Date.now(),
						})
					}

					await ctx.db.delete(subfolder._id)
				}
			} else {
				// Move contents to parent folder
				for (const doc of documents) {
					await ctx.db.patch(doc._id, {
						parentFolderId: folder.parentId,
						updatedAt: Date.now(),
					})
				}

				for (const subfolder of subfolders) {
					await ctx.db.patch(subfolder._id, {
						parentId: folder.parentId,
					})
				}
			}
		}

		// Delete the folder
		await ctx.db.delete(args.folderId)

		return null
	},
})

/**
 * Move a folder to a different parent
 */
export const moveFolder = mutation({
	args: {
		folderId: v.id("folders"),
		newParentId: v.optional(v.id("folders")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const folder = await ctx.db.get(args.folderId)
		if (!folder) {
			throw new Error("Folder not found")
		}

		if (folder.ownerId !== user._id) {
			throw new Error("Access denied: You don't own this folder")
		}

		// Can't move a folder into itself
		if (args.newParentId === args.folderId) {
			throw new Error("Cannot move a folder into itself")
		}

		// Verify new parent exists and user owns it
		if (args.newParentId) {
			const newParent = await ctx.db.get(args.newParentId)
			if (!newParent || newParent.ownerId !== user._id) {
				throw new Error("Target folder not found or access denied")
			}

			// Check for circular reference
			let currentParent: Id<"folders"> | undefined = args.newParentId
			while (currentParent) {
				if (currentParent === args.folderId) {
					throw new Error("Cannot move a folder into one of its subfolders")
				}
				const parent: { parentId?: Id<"folders"> } | null = await ctx.db.get(currentParent)
				currentParent = parent?.parentId
			}
		}

		await ctx.db.patch(args.folderId, {
			parentId: args.newParentId,
		})

		return null
	},
})

/**
 * List all folders for the current user
 */
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

		let folders

		if (args.parentId !== undefined) {
			folders = await ctx.db
				.query("folders")
				.withIndex("by_parent", (q: any) => q.eq("parentId", args.parentId))
				.collect()
		} else {
			folders = await ctx.db
				.query("folders")
				.withIndex("by_owner", (q: any) => q.eq("ownerId", user._id))
				.collect()

			// If no parentId specified, return root folders only
			folders = folders.filter((f: any) => !f.parentId)
		}

		// Filter to only user's folders
		folders = folders.filter((f: any) => f.ownerId === user._id)

		return folders
	},
})

/**
 * Get folder contents (documents and subfolders)
 */
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

		// Get subfolders
		let folders
		if (args.folderId) {
			folders = await ctx.db
				.query("folders")
				.withIndex("by_parent", (q: any) => q.eq("parentId", args.folderId))
				.collect()
		} else {
			// Root level - folders without parent
			folders = await ctx.db
				.query("folders")
				.withIndex("by_owner", (q: any) => q.eq("ownerId", user._id))
				.collect()
			folders = folders.filter((f: any) => !f.parentId)
		}

		// Filter to user's folders
		folders = folders.filter((f: any) => f.ownerId === user._id)

		// Get documents in folder
		let documents
		if (args.folderId) {
			documents = await ctx.db
				.query("documents")
				.withIndex("by_folder", (q: any) => q.eq("parentFolderId", args.folderId))
				.collect()
		} else {
			// Root level - documents without folder
			documents = await ctx.db
				.query("documents")
				.withIndex("by_owner", (q: any) => q.eq("ownerId", user._id))
				.collect()
			documents = documents.filter((d: any) => !d.parentFolderId)
		}

		// Filter user's documents that aren't deleted
		documents = documents.filter((d: any) => d.ownerId === user._id && !d.isDeleted)

		// Sort by name/title
		folders.sort((a: any, b: any) => a.name.localeCompare(b.name))
		documents.sort((a: any, b: any) => a.title.localeCompare(b.title))

		return { folders, documents }
	},
})

/**
 * Get a single folder
 */
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

		const folder = await ctx.db.get(args.folderId)
		if (!folder || folder.ownerId !== user._id) {
			return null
		}

		return folder
	},
})

/**
 * Get folder breadcrumb path
 */
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
			const folder: {
				_id: Id<"folders">
				name: string
				ownerId: string
				parentId?: Id<"folders">
			} | null = await ctx.db.get(currentId)
			if (!folder || folder.ownerId !== user._id) {
				break
			}
			path.unshift({ _id: folder._id, name: folder.name })
			currentId = folder.parentId
		}

		return path
	},
})
