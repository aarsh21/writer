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

// Generate a random color for user cursor
function generateUserColor(): string {
	const colors = [
		"#EF4444", // red
		"#F97316", // orange
		"#EAB308", // yellow
		"#22C55E", // green
		"#14B8A6", // teal
		"#3B82F6", // blue
		"#8B5CF6", // violet
		"#EC4899", // pink
		"#F43F5E", // rose
		"#06B6D4", // cyan
	]
	return colors[Math.floor(Math.random() * colors.length)]
}

// Stale presence threshold (30 seconds)
const PRESENCE_STALE_THRESHOLD = 30 * 1000

/**
 * Update user presence in a document
 * Should be called frequently (e.g., every 5-10 seconds) to keep presence alive
 */
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
		const userName = user.name || user.email || "Anonymous"

		// Check if presence already exists
		const existing = await ctx.db
			.query("userPresence")
			.withIndex("by_document_user", (q: any) =>
				q.eq("documentId", args.documentId).eq("userId", userId),
			)
			.unique()

		const now = Date.now()

		if (existing) {
			// Update existing presence
			await ctx.db.patch(existing._id, {
				cursorPosition: args.cursorPosition,
				selection: args.selection,
				lastSeen: now,
				userName, // Update name in case it changed
			})
		} else {
			// Create new presence entry
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

/**
 * Remove user presence when leaving a document
 */
export const removePresence = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPresence")
			.withIndex("by_document_user", (q: any) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (existing) {
			await ctx.db.delete(existing._id)
		}

		return null
	},
})

/**
 * Get all active users in a document
 * Returns only users who have been active in the last 30 seconds
 */
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

		const presenceData = await ctx.db
			.query("userPresence")
			.withIndex("by_document", (q: any) => q.eq("documentId", args.documentId))
			.collect()

		// Filter out stale presence and current user, and exclude _creationTime
		return presenceData
			.filter((p) => p.lastSeen > threshold && p.userId !== user._id)
			.map(({ _creationTime, ...rest }) => rest)
	},
})

/**
 * Get count of active users in a document
 */
export const getActiveUserCount = query({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const now = Date.now()
		const threshold = now - PRESENCE_STALE_THRESHOLD

		const presenceData = await ctx.db
			.query("userPresence")
			.withIndex("by_document", (q: any) => q.eq("documentId", args.documentId))
			.collect()

		return presenceData.filter((p: any) => p.lastSeen > threshold).length
	},
})

/**
 * Heartbeat - simple presence update without cursor data
 * Use this for keeping presence alive when user is idle
 */
export const heartbeat = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		const existing = await ctx.db
			.query("userPresence")
			.withIndex("by_document_user", (q: any) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (existing) {
			await ctx.db.patch(existing._id, {
				lastSeen: Date.now(),
			})
		}

		return null
	},
})

/**
 * Clean up stale presence data
 * Should be run periodically (e.g., via cron job)
 */
export const cleanupStalePresence = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		const now = Date.now()
		const threshold = now - PRESENCE_STALE_THRESHOLD * 2 // 1 minute threshold for cleanup

		const allPresence = await ctx.db.query("userPresence").collect()

		let deletedCount = 0
		for (const presence of allPresence) {
			if (presence.lastSeen < threshold) {
				await ctx.db.delete(presence._id)
				deletedCount++
			}
		}

		return deletedCount
	},
})

/**
 * Get presence data for all documents the user has access to
 * Useful for showing activity indicators in document list
 */
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
				const presenceData = await ctx.db
					.query("userPresence")
					.withIndex("by_document", (q: any) => q.eq("documentId", documentId))
					.collect()

				const activeCount = presenceData.filter((p: any) => p.lastSeen > threshold).length

				return { documentId, activeCount }
			}),
		)

		return results
	},
})

/**
 * Update cursor position only (optimized for frequent updates)
 */
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
			.withIndex("by_document_user", (q: any) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (existing) {
			await ctx.db.patch(existing._id, {
				cursorPosition: args.cursorPosition,
				lastSeen: Date.now(),
			})
		}

		return null
	},
})

/**
 * Update selection only (optimized for frequent updates)
 */
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
			.withIndex("by_document_user", (q: any) =>
				q.eq("documentId", args.documentId).eq("userId", user._id),
			)
			.unique()

		if (existing) {
			await ctx.db.patch(existing._id, {
				selection: args.selection,
				lastSeen: Date.now(),
			})
		}

		return null
	},
})
