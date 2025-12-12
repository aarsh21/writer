import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"

import { getAuthUserSafe } from "./auth"

async function getAuthenticatedUser(ctx: MutationCtx) {
	const user = await getAuthUserSafe(ctx)
	if (!user) throw new Error("Unauthorized: User not authenticated")
	return user
}

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

const keyboardShortcutsValidator = v.object({
	toggleSidebar: v.optional(v.string()),
	commandPalette: v.optional(v.string()),
	newDocument: v.optional(v.string()),
})

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
		if (!user) return { userId: "", ...DEFAULT_PREFERENCES }

		const preferences = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique()

		if (!preferences) return { userId: user._id, ...DEFAULT_PREFERENCES }

		return {
			userId: user._id,
			theme: preferences.theme ?? DEFAULT_PREFERENCES.theme,
			editorFontSize: preferences.editorFontSize ?? DEFAULT_PREFERENCES.editorFontSize,
			editorLineHeight: preferences.editorLineHeight ?? DEFAULT_PREFERENCES.editorLineHeight,
			recentDocuments: preferences.recentDocuments ?? DEFAULT_PREFERENCES.recentDocuments,
			keyboardShortcuts: {
				toggleSidebar:
					preferences.keyboardShortcuts?.toggleSidebar ??
					DEFAULT_PREFERENCES.keyboardShortcuts.toggleSidebar,
				commandPalette:
					preferences.keyboardShortcuts?.commandPalette ??
					DEFAULT_PREFERENCES.keyboardShortcuts.commandPalette,
				newDocument:
					preferences.keyboardShortcuts?.newDocument ??
					DEFAULT_PREFERENCES.keyboardShortcuts.newDocument,
			},
		}
	},
})

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
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique()

		const updates: Record<string, unknown> = {}
		if (args.theme !== undefined) updates.theme = args.theme
		if (args.editorFontSize !== undefined) updates.editorFontSize = args.editorFontSize
		if (args.editorLineHeight !== undefined) updates.editorLineHeight = args.editorLineHeight
		if (args.keyboardShortcuts !== undefined) {
			const existingShortcuts = existing?.keyboardShortcuts ?? {}
			updates.keyboardShortcuts = { ...existingShortcuts, ...args.keyboardShortcuts }
		}

		if (existing) {
			await ctx.db.patch("userPreferences", existing._id, updates)
		} else {
			await ctx.db.insert("userPreferences", { userId: user._id, ...updates })
		}

		return null
	},
})

export const addToRecentDocuments = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique()

		const MAX_RECENT = 10

		if (existing) {
			const recent = (existing.recentDocuments ?? []).filter((id) => id !== args.documentId)
			recent.unshift(args.documentId)
			const trimmed = recent.slice(0, MAX_RECENT)

			await ctx.db.patch("userPreferences", existing._id, { recentDocuments: trimmed })
		} else {
			await ctx.db.insert("userPreferences", {
				userId: user._id,
				recentDocuments: [args.documentId],
			})
		}

		return null
	},
})

export const removeFromRecentDocuments = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique()

		if (existing?.recentDocuments) {
			const recent = existing.recentDocuments.filter((id) => id !== args.documentId)
			await ctx.db.patch("userPreferences", existing._id, { recentDocuments: recent })
		}

		return null
	},
})

export const clearRecentDocuments = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique()

		if (existing) {
			await ctx.db.patch("userPreferences", existing._id, { recentDocuments: [] })
		}

		return null
	},
})

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

		const count = args.limit ?? 10

		const preferences = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique()

		if (!preferences?.recentDocuments) return []

		const documents = await Promise.all(
			preferences.recentDocuments.slice(0, count).map(async (docId) => {
				const doc = await ctx.db.get("documents", docId)
				return doc && !doc.isDeleted ? doc : null
			}),
		)

		return documents.filter((doc): doc is Doc<"documents"> => doc !== null)
	},
})

export const resetPreferences = mutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique()

		if (existing) {
			await ctx.db.patch("userPreferences", existing._id, {
				theme: DEFAULT_PREFERENCES.theme,
				editorFontSize: DEFAULT_PREFERENCES.editorFontSize,
				editorLineHeight: DEFAULT_PREFERENCES.editorLineHeight,
				keyboardShortcuts: DEFAULT_PREFERENCES.keyboardShortcuts,
			})
		}

		return null
	},
})

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
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique()

		const existingShortcuts = existing?.keyboardShortcuts ?? DEFAULT_PREFERENCES.keyboardShortcuts
		const newShortcuts = {
			toggleSidebar: args.toggleSidebar ?? existingShortcuts.toggleSidebar,
			commandPalette: args.commandPalette ?? existingShortcuts.commandPalette,
			newDocument: args.newDocument ?? existingShortcuts.newDocument,
		}

		if (existing) {
			await ctx.db.patch("userPreferences", existing._id, { keyboardShortcuts: newShortcuts })
		} else {
			await ctx.db.insert("userPreferences", { userId: user._id, keyboardShortcuts: newShortcuts })
		}

		return null
	},
})

export const setTheme = mutation({
	args: {
		theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique()

		if (existing) {
			await ctx.db.patch("userPreferences", existing._id, { theme: args.theme })
		} else {
			await ctx.db.insert("userPreferences", { userId: user._id, theme: args.theme })
		}

		return null
	},
})

export const setEditorFontSize = mutation({
	args: {
		fontSize: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		if (args.fontSize < 12 || args.fontSize > 24) {
			throw new Error("Font size must be between 12 and 24")
		}

		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique()

		if (existing) {
			await ctx.db.patch("userPreferences", existing._id, { editorFontSize: args.fontSize })
		} else {
			await ctx.db.insert("userPreferences", { userId: user._id, editorFontSize: args.fontSize })
		}

		return null
	},
})
