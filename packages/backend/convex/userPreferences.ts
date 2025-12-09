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

// Default preferences
const DEFAULT_PREFERENCES = {
	theme: "system" as string,
	editorFontSize: 16,
	editorLineHeight: 1.6,
	recentDocuments: [] as Id<"documents">[],
	keyboardShortcuts: {
		toggleSidebar: "b",
		commandPalette: "k",
		newDocument: "n",
	},
}

// Keyboard shortcuts validator
const keyboardShortcutsValidator = v.object({
	toggleSidebar: v.optional(v.string()),
	commandPalette: v.optional(v.string()),
	newDocument: v.optional(v.string()),
})

/**
 * Get user preferences
 */
export const getUserPreferences = query({
	args: {},
	returns: v.object({
		userId: v.string(),
		theme: v.string(),
		editorFontSize: v.number(),
		editorLineHeight: v.number(),
		recentDocuments: v.array(v.id("documents")),
		keyboardShortcuts: v.object({
			toggleSidebar: v.string(),
			commandPalette: v.string(),
			newDocument: v.string(),
		}),
	}),
	handler: async (ctx) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) {
			return {
				userId: "",
				...DEFAULT_PREFERENCES,
			}
		}

		const preferences = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q: any) => q.eq("userId", user._id))
			.unique()

		if (!preferences) {
			return {
				userId: user._id,
				...DEFAULT_PREFERENCES,
			}
		}

		return {
			userId: user._id,
			theme: preferences.theme || DEFAULT_PREFERENCES.theme,
			editorFontSize: preferences.editorFontSize || DEFAULT_PREFERENCES.editorFontSize,
			editorLineHeight: preferences.editorLineHeight || DEFAULT_PREFERENCES.editorLineHeight,
			recentDocuments: preferences.recentDocuments || DEFAULT_PREFERENCES.recentDocuments,
			keyboardShortcuts: {
				toggleSidebar:
					preferences.keyboardShortcuts?.toggleSidebar ||
					DEFAULT_PREFERENCES.keyboardShortcuts.toggleSidebar,
				commandPalette:
					preferences.keyboardShortcuts?.commandPalette ||
					DEFAULT_PREFERENCES.keyboardShortcuts.commandPalette,
				newDocument:
					preferences.keyboardShortcuts?.newDocument ||
					DEFAULT_PREFERENCES.keyboardShortcuts.newDocument,
			},
		}
	},
})

/**
 * Update user preferences
 */
export const updateUserPreferences = mutation({
	args: {
		theme: v.optional(v.string()),
		editorFontSize: v.optional(v.number()),
		editorLineHeight: v.optional(v.number()),
		keyboardShortcuts: v.optional(keyboardShortcutsValidator),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q: any) => q.eq("userId", user._id))
			.unique()

		const updates: Record<string, any> = {}
		if (args.theme !== undefined) updates.theme = args.theme
		if (args.editorFontSize !== undefined) updates.editorFontSize = args.editorFontSize
		if (args.editorLineHeight !== undefined) updates.editorLineHeight = args.editorLineHeight
		if (args.keyboardShortcuts !== undefined) {
			// Merge with existing shortcuts
			const existingShortcuts = existing?.keyboardShortcuts || {}
			updates.keyboardShortcuts = {
				...existingShortcuts,
				...args.keyboardShortcuts,
			}
		}

		if (existing) {
			await ctx.db.patch(existing._id, updates)
		} else {
			await ctx.db.insert("userPreferences", {
				userId: user._id,
				...updates,
			})
		}

		return null
	},
})

/**
 * Add a document to recent documents list
 */
export const addToRecentDocuments = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q: any) => q.eq("userId", user._id))
			.unique()

		const MAX_RECENT = 10

		if (existing) {
			let recentDocs = existing.recentDocuments || []

			// Remove if already in list
			recentDocs = recentDocs.filter((id: Id<"documents">) => id !== args.documentId)

			// Add to front
			recentDocs.unshift(args.documentId)

			// Trim to max
			recentDocs = recentDocs.slice(0, MAX_RECENT)

			await ctx.db.patch(existing._id, {
				recentDocuments: recentDocs,
			})
		} else {
			await ctx.db.insert("userPreferences", {
				userId: user._id,
				recentDocuments: [args.documentId],
			})
		}

		return null
	},
})

/**
 * Remove a document from recent documents list
 */
export const removeFromRecentDocuments = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q: any) => q.eq("userId", user._id))
			.unique()

		if (existing && existing.recentDocuments) {
			const recentDocs = existing.recentDocuments.filter(
				(id: Id<"documents">) => id !== args.documentId,
			)

			await ctx.db.patch(existing._id, {
				recentDocuments: recentDocs,
			})
		}

		return null
	},
})

/**
 * Clear recent documents list
 */
export const clearRecentDocuments = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q: any) => q.eq("userId", user._id))
			.unique()

		if (existing) {
			await ctx.db.patch(existing._id, {
				recentDocuments: [],
			})
		}

		return null
	},
})

/**
 * Get recent documents with full document data
 */
export const getRecentDocumentsWithData = query({
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

		const preferences = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q: any) => q.eq("userId", user._id))
			.unique()

		if (!preferences || !preferences.recentDocuments) {
			return []
		}

		const documents = await Promise.all(
			preferences.recentDocuments.slice(0, limit).map(async (docId: Id<"documents">) => {
				const doc = await ctx.db.get(docId)
				return doc && !doc.isDeleted ? doc : null
			}),
		)

		return documents.filter(Boolean) as any[]
	},
})

/**
 * Reset all preferences to defaults
 */
export const resetPreferences = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q: any) => q.eq("userId", user._id))
			.unique()

		if (existing) {
			await ctx.db.patch(existing._id, {
				theme: DEFAULT_PREFERENCES.theme,
				editorFontSize: DEFAULT_PREFERENCES.editorFontSize,
				editorLineHeight: DEFAULT_PREFERENCES.editorLineHeight,
				keyboardShortcuts: DEFAULT_PREFERENCES.keyboardShortcuts,
				// Keep recent documents
			})
		}

		return null
	},
})

/**
 * Update keyboard shortcuts
 */
export const updateKeyboardShortcuts = mutation({
	args: {
		toggleSidebar: v.optional(v.string()),
		commandPalette: v.optional(v.string()),
		newDocument: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q: any) => q.eq("userId", user._id))
			.unique()

		const existingShortcuts = existing?.keyboardShortcuts || DEFAULT_PREFERENCES.keyboardShortcuts
		const newShortcuts = {
			toggleSidebar: args.toggleSidebar ?? existingShortcuts.toggleSidebar,
			commandPalette: args.commandPalette ?? existingShortcuts.commandPalette,
			newDocument: args.newDocument ?? existingShortcuts.newDocument,
		}

		if (existing) {
			await ctx.db.patch(existing._id, {
				keyboardShortcuts: newShortcuts,
			})
		} else {
			await ctx.db.insert("userPreferences", {
				userId: user._id,
				keyboardShortcuts: newShortcuts,
			})
		}

		return null
	},
})

/**
 * Set theme preference
 */
export const setTheme = mutation({
	args: {
		theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q: any) => q.eq("userId", user._id))
			.unique()

		if (existing) {
			await ctx.db.patch(existing._id, {
				theme: args.theme,
			})
		} else {
			await ctx.db.insert("userPreferences", {
				userId: user._id,
				theme: args.theme,
			})
		}

		return null
	},
})

/**
 * Set editor font size
 */
export const setEditorFontSize = mutation({
	args: {
		fontSize: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		// Validate font size (12-24)
		if (args.fontSize < 12 || args.fontSize > 24) {
			throw new Error("Font size must be between 12 and 24")
		}

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q: any) => q.eq("userId", user._id))
			.unique()

		if (existing) {
			await ctx.db.patch(existing._id, {
				editorFontSize: args.fontSize,
			})
		} else {
			await ctx.db.insert("userPreferences", {
				userId: user._id,
				editorFontSize: args.fontSize,
			})
		}

		return null
	},
})
