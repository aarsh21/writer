import { ConvexError, v } from "convex/values"

import { internalMutation, mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"

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

function generateUserColor(): string {
	const colors = [
		"#EF4444",
		"#F97316",
		"#EAB308",
		"#22C55E",
		"#14B8A6",
		"#3B82F6",
		"#8B5CF6",
		"#EC4899",
		"#F43F5E",
		"#06B6D4",
	]
	return colors[Math.floor(Math.random() * colors.length)]
}

const PRESENCE_STALE_THRESHOLD = 30 * 1000

export const updatePresence = mutation({
	args: {
		documentId: v.id("documents"),
		cursorPosition: v.optional(v.number()),
		selection: v.optional(
			v.object({
				from: v.number(),
				to: v.number(),
			}),
		),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)
		const userId = user._id
		const userName = user.name ?? user.email ?? "Anonymous"

		const existing = await ctx.db
			.query("userPresence")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", userId),
			)
			.unique()

		const now = Date.now()

		if (existing) {
			await ctx.db.patch("userPresence", existing._id, {
				cursorPosition: args.cursorPosition,
				selection: args.selection,
				lastSeen: now,
				userName,
			})
		} else {
			await ctx.db.insert("userPresence", {
				documentId: args.documentId,
				userId,
				userName,
				userColor: generateUserColor(),
				cursorPosition: args.cursorPosition,
				selection: args.selection,
				lastSeen: now,
			})
		}

		return null
	},
})

export const removePresence = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPresence")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (existing) await ctx.db.delete("userPresence", existing._id)

		return null
	},
})

export const getActiveUsers = query({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.array(
		v.object({
			_id: v.id("userPresence"),
			documentId: v.id("documents"),
			userId: v.string(),
			userName: v.string(),
			userColor: v.string(),
			cursorPosition: v.optional(v.number()),
			selection: v.optional(
				v.object({
					from: v.number(),
					to: v.number(),
				}),
			),
			lastSeen: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return []

		const now = Date.now()
		const threshold = now - PRESENCE_STALE_THRESHOLD

		const presence = await ctx.db
			.query("userPresence")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()

		return presence
			.filter((p) => p.lastSeen > threshold && p.userId !== user._id)
			.map((p) => ({
				_id: p._id,
				documentId: p.documentId,
				userId: p.userId,
				userName: p.userName,
				userColor: p.userColor,
				cursorPosition: p.cursorPosition,
				selection: p.selection,
				lastSeen: p.lastSeen,
			}))
	},
})

export const getActiveUserCount = query({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const now = Date.now()
		const threshold = now - PRESENCE_STALE_THRESHOLD

		const presence = await ctx.db
			.query("userPresence")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect()

		return presence.filter((p) => p.lastSeen > threshold).length
	},
})

export const heartbeat = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPresence")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (existing) {
			await ctx.db.patch("userPresence", existing._id, { lastSeen: Date.now() })
		}

		return null
	},
})

export const cleanupStalePresence = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const now = Date.now()
		const threshold = now - PRESENCE_STALE_THRESHOLD * 2

		const all = await ctx.db.query("userPresence").collect()

		let deleted = 0
		for (const presence of all) {
			if (presence.lastSeen < threshold) {
				await ctx.db.delete("userPresence", presence._id)
				deleted++
			}
		}

		return deleted
	},
})

export const getPresenceForDocuments = query({
	args: {
		documentIds: v.array(v.id("documents")),
	},
	returns: v.array(
		v.object({
			documentId: v.id("documents"),
			activeCount: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const now = Date.now()
		const threshold = now - PRESENCE_STALE_THRESHOLD

		const results = await Promise.all(
			args.documentIds.map(async (documentId) => {
				const presence = await ctx.db
					.query("userPresence")
					.withIndex("by_document", (q) => q.eq("documentId", documentId))
					.collect()

				const activeCount = presence.filter((p) => p.lastSeen > threshold).length

				return { documentId, activeCount }
			}),
		)

		return results
	},
})

export const updateCursorPosition = mutation({
	args: {
		documentId: v.id("documents"),
		cursorPosition: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPresence")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (existing) {
			await ctx.db.patch("userPresence", existing._id, {
				cursorPosition: args.cursorPosition,
				lastSeen: Date.now(),
			})
		}

		return null
	},
})

export const updateSelection = mutation({
	args: {
		documentId: v.id("documents"),
		selection: v.object({
			from: v.number(),
			to: v.number(),
		}),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPresence")
			.withIndex("by_document_user", (q) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (existing) {
			await ctx.db.patch("userPresence", existing._id, {
				selection: args.selection,
				lastSeen: Date.now(),
			})
		}

		return null
	},
})
