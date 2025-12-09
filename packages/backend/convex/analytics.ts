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

/**
 * Track a document view
 */
export const trackDocumentView = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		// Verify access
		await checkDocumentAccess(ctx, args.documentId, user._id)

		await ctx.db.insert("documentAnalytics", {
			documentId: args.documentId,
			userId: user._id,
			action: "view",
			timestamp: Date.now(),
		})

		return null
	},
})

/**
 * Track a document edit
 */
export const trackDocumentEdit = mutation({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthenticatedUser(ctx)

		// Verify access
		await checkDocumentAccess(ctx, args.documentId, user._id)

		await ctx.db.insert("documentAnalytics", {
			documentId: args.documentId,
			userId: user._id,
			action: "edit",
			timestamp: Date.now(),
		})

		return null
	},
})

/**
 * Get document statistics
 */
export const getDocumentStats = query({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.object({
		totalViews: v.number(),
		totalEdits: v.number(),
		uniqueViewers: v.number(),
		uniqueEditors: v.number(),
		lastViewed: v.optional(v.number()),
		lastEdited: v.optional(v.number()),
	}),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) {
			return {
				totalViews: 0,
				totalEdits: 0,
				uniqueViewers: 0,
				uniqueEditors: 0,
				lastViewed: undefined,
				lastEdited: undefined,
			}
		}

		try {
			await checkDocumentAccess(ctx, args.documentId, user._id)
		} catch {
			return {
				totalViews: 0,
				totalEdits: 0,
				uniqueViewers: 0,
				uniqueEditors: 0,
				lastViewed: undefined,
				lastEdited: undefined,
			}
		}

		const analytics = await ctx.db
			.query("documentAnalytics")
			.withIndex("by_document", (q: any) => q.eq("documentId", args.documentId))
			.collect()

		const views = analytics.filter((a: any) => a.action === "view")
		const edits = analytics.filter((a: any) => a.action === "edit")

		const uniqueViewers = new Set(views.map((v: any) => v.userId)).size
		const uniqueEditors = new Set(edits.map((e: any) => e.userId)).size

		const lastView = views.sort((a: any, b: any) => b.timestamp - a.timestamp)[0]
		const lastEdit = edits.sort((a: any, b: any) => b.timestamp - a.timestamp)[0]

		return {
			totalViews: views.length,
			totalEdits: edits.length,
			uniqueViewers,
			uniqueEditors,
			lastViewed: lastView?.timestamp,
			lastEdited: lastEdit?.timestamp,
		}
	},
})

/**
 * Get recent activity for a document
 */
export const getRecentActivity = query({
	args: {
		documentId: v.id("documents"),
		limit: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			_id: v.id("documentAnalytics"),
			documentId: v.id("documents"),
			userId: v.string(),
			action: v.union(v.literal("view"), v.literal("edit")),
			timestamp: v.number(),
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

		const analytics = await ctx.db
			.query("documentAnalytics")
			.withIndex("by_document", (q: any) => q.eq("documentId", args.documentId))
			.collect()

		// Sort by timestamp descending and limit
		analytics.sort((a: any, b: any) => b.timestamp - a.timestamp)
		return analytics.slice(0, limit)
	},
})

/**
 * Get user activity summary
 */
export const getUserActivitySummary = query({
	args: {
		days: v.optional(v.number()),
	},
	returns: v.object({
		totalViews: v.number(),
		totalEdits: v.number(),
		documentsViewed: v.number(),
		documentsEdited: v.number(),
	}),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) {
			return {
				totalViews: 0,
				totalEdits: 0,
				documentsViewed: 0,
				documentsEdited: 0,
			}
		}

		const days = args.days || 30
		const since = Date.now() - days * 24 * 60 * 60 * 1000

		const analytics = await ctx.db
			.query("documentAnalytics")
			.withIndex("by_user", (q: any) => q.eq("userId", user._id))
			.collect()

		const filtered = analytics.filter((a: any) => a.timestamp >= since)

		const views = filtered.filter((a: any) => a.action === "view")
		const edits = filtered.filter((a: any) => a.action === "edit")

		const documentsViewed = new Set(views.map((v: any) => v.documentId)).size
		const documentsEdited = new Set(edits.map((e: any) => e.documentId)).size

		return {
			totalViews: views.length,
			totalEdits: edits.length,
			documentsViewed,
			documentsEdited,
		}
	},
})

/**
 * Get most active documents for the user
 */
export const getMostActiveDocuments = query({
	args: {
		limit: v.optional(v.number()),
		days: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			documentId: v.id("documents"),
			viewCount: v.number(),
			editCount: v.number(),
			totalActivity: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUserSafe(ctx)
		if (!user) return []

		const limit = args.limit || 10
		const days = args.days || 30
		const since = Date.now() - days * 24 * 60 * 60 * 1000

		const analytics = await ctx.db
			.query("documentAnalytics")
			.withIndex("by_user", (q: any) => q.eq("userId", user._id))
			.collect()

		const filtered = analytics.filter((a: any) => a.timestamp >= since)

		// Group by document
		const byDocument = new Map<Id<"documents">, { views: number; edits: number }>()

		for (const entry of filtered) {
			const existing = byDocument.get(entry.documentId) || {
				views: 0,
				edits: 0,
			}
			if (entry.action === "view") {
				existing.views++
			} else {
				existing.edits++
			}
			byDocument.set(entry.documentId, existing)
		}

		// Convert to array and sort by total activity
		const results = Array.from(byDocument.entries())
			.map(([documentId, stats]) => ({
				documentId,
				viewCount: stats.views,
				editCount: stats.edits,
				totalActivity: stats.views + stats.edits,
			}))
			.sort((a, b) => b.totalActivity - a.totalActivity)
			.slice(0, limit)

		return results
	},
})

/**
 * Clean up old analytics data
 * Can be scheduled as a cron job
 */
export const cleanupOldAnalytics = internalMutation({
	args: {
		daysToKeep: v.optional(v.number()),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const daysToKeep = args.daysToKeep || 90
		const threshold = Date.now() - daysToKeep * 24 * 60 * 60 * 1000

		const allAnalytics = await ctx.db.query("documentAnalytics").collect()

		let deletedCount = 0
		for (const entry of allAnalytics) {
			if (entry.timestamp < threshold) {
				await ctx.db.delete(entry._id)
				deletedCount++
			}
		}

		return deletedCount
	},
})

/**
 * Get activity timeline for a document
 */
export const getActivityTimeline = query({
	args: {
		documentId: v.id("documents"),
		days: v.optional(v.number()),
	},
	returns: v.array(
		v.object({
			date: v.string(),
			views: v.number(),
			edits: v.number(),
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

		const days = args.days || 7
		const since = Date.now() - days * 24 * 60 * 60 * 1000

		const analytics = await ctx.db
			.query("documentAnalytics")
			.withIndex("by_document", (q: any) => q.eq("documentId", args.documentId))
			.collect()

		const filtered = analytics.filter((a: any) => a.timestamp >= since)

		// Group by date
		const byDate = new Map<string, { views: number; edits: number }>()

		for (const entry of filtered) {
			const date = new Date(entry.timestamp).toISOString().split("T")[0]
			const existing = byDate.get(date) || { views: 0, edits: 0 }
			if (entry.action === "view") {
				existing.views++
			} else {
				existing.edits++
			}
			byDate.set(date, existing)
		}

		// Fill in missing dates
		const result: Array<{ date: string; views: number; edits: number }> = []
		const now = new Date()

		for (let i = days - 1; i >= 0; i--) {
			const date = new Date(now)
			date.setDate(date.getDate() - i)
			const dateStr = date.toISOString().split("T")[0]
			const stats = byDate.get(dateStr) || { views: 0, edits: 0 }
			result.push({
				date: dateStr,
				views: stats.views,
				edits: stats.edits,
			})
		}

		return result
	},
})
