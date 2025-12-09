import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
	// Documents table - stores all document data
	documents: defineTable({
		title: v.string(),
		content: v.string(), // JSON stringified Tiptap content
		ownerId: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
		isDeleted: v.boolean(),
		parentFolderId: v.optional(v.id("folders")),
	})
		.index("by_owner", ["ownerId"])
		.index("by_folder", ["parentFolderId"])
		.index("by_owner_deleted", ["ownerId", "isDeleted"])
		.searchIndex("search_title", {
			searchField: "title",
			filterFields: ["ownerId", "isDeleted"],
		}),

	// Folders table - for document organization
	folders: defineTable({
		name: v.string(),
		ownerId: v.string(),
		parentId: v.optional(v.id("folders")),
		createdAt: v.number(),
	})
		.index("by_owner", ["ownerId"])
		.index("by_parent", ["parentId"]),

	// Document collaborators - manages sharing and permissions
	documentCollaborators: defineTable({
		documentId: v.id("documents"),
		userId: v.string(),
		role: v.union(v.literal("viewer"), v.literal("editor"), v.literal("owner")),
		addedAt: v.number(),
	})
		.index("by_document", ["documentId"])
		.index("by_user", ["userId"])
		.index("by_document_user", ["documentId", "userId"]),

	// Document versions - for version history
	documentVersions: defineTable({
		documentId: v.id("documents"),
		content: v.string(),
		title: v.string(),
		createdAt: v.number(),
		createdBy: v.string(),
	}).index("by_document", ["documentId"]),

	// User presence - tracks active users in documents
	userPresence: defineTable({
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
	})
		.index("by_document", ["documentId"])
		.index("by_user", ["userId"])
		.index("by_document_user", ["documentId", "userId"]),

	// User preferences - stores user settings
	userPreferences: defineTable({
		userId: v.string(),
		theme: v.optional(v.string()),
		editorFontSize: v.optional(v.number()),
		editorLineHeight: v.optional(v.number()),
		recentDocuments: v.optional(v.array(v.id("documents"))),
		// Keyboard shortcuts
		keyboardShortcuts: v.optional(
			v.object({
				toggleSidebar: v.optional(v.string()), // e.g., "b", "s", etc.
				commandPalette: v.optional(v.string()), // e.g., "k"
				newDocument: v.optional(v.string()), // e.g., "n"
			}),
		),
	}).index("by_user", ["userId"]),

	// Document analytics - tracks views and edits
	documentAnalytics: defineTable({
		documentId: v.id("documents"),
		userId: v.string(),
		action: v.union(v.literal("view"), v.literal("edit")),
		timestamp: v.number(),
	})
		.index("by_document", ["documentId"])
		.index("by_user", ["userId"]),
})
