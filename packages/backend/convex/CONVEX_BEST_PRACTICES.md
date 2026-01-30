# Convex Best Practices Guide

This document outlines the best practices applied to our Convex backend and serves as a reference for future development.

## Overview

Our Convex backend follows the official Convex best practices for:

- Function organization
- Type safety and validation
- Error handling
- Query optimization
- Write conflict avoidance

## Key Improvements Made

### 1. Error Handling with ConvexError

**Before:**

```typescript
throw new Error("Document not found")
```

**After:**

```typescript
throw new ConvexError({
	code: "NOT_FOUND",
	message: "Document not found",
})
```

All user-facing errors now use `ConvexError` with proper error codes:

- `"UNAUTHORIZED"` - Authentication failures
- `"NOT_FOUND"` - Missing documents/resources
- `"FORBIDDEN"` - Permission/access denied
- `"VALIDATION_ERROR"` - Input validation errors
- `"CONFLICT"` - Duplicate/constraint violations

### 2. Shared Utilities

Created `convex/lib/utils.ts` with shared helper functions:

```typescript
import { getAuthenticatedUser, checkDocumentAccess, checkFolderAccess } from "./lib/utils"

// Use in any mutation/query
const user = await getAuthenticatedUser(ctx)
const { document, role } = await checkDocumentAccess(ctx, documentId, user._id, "editor")
```

Benefits:

- Consistent authentication and authorization
- DRY (Don't Repeat Yourself) principle
- Centralized error handling

### 3. Proper Return Validators

All functions now define explicit return validators:

```typescript
export const getDocument = query({
	args: { documentId: v.id("documents") },
	returns: v.union(
		v.object({
			/* document shape */
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		// implementation
	},
})
```

**Notable fix:** `auth.ts` `getCurrentUser` now uses a proper user validator instead of `v.any()`.

### 4. Query Optimization with Indexes

All queries use indexes instead of filtering:

**Good:**

```typescript
return ctx.db
	.query("documents")
	.withIndex("by_owner", (q) => q.eq("ownerId", user._id))
	.collect()
```

**Avoid:**

```typescript
return ctx.db
	.query("documents")
	.filter((q) => q.eq(q.field("ownerId"), user._id))
	.collect()
```

### 5. Parallel Operations with Promise.all

**Before:**

```typescript
for (const collab of collaborators) {
	await ctx.db.delete(collab._id)
}
for (const version of versions) {
	await ctx.db.delete(version._id)
}
```

**After:**

```typescript
await Promise.all([
	...collaborators.map((collab) => ctx.db.delete(collab._id)),
	...versions.map((version) => ctx.db.delete(version._id)),
])
```

Applied in:

- `permanentlyDeleteDocument` mutation
- `emptyTrash` mutation
- `deleteFolder` mutation (recursive operations)

### 6. Idempotent Mutations

Mutations are designed to be safely retried:

```typescript
export const deleteDocument = mutation({
	handler: async (ctx, args) => {
		// Idempotent: marking as deleted is safe to retry
		await ctx.db.patch(args.documentId, { isDeleted: true })
		return null
	},
})
```

### 7. TypeScript Best Practices

- Using `Id<"tableName">` for document references
- Using `Doc<"tableName">` for full document types
- Proper type annotations on helper functions

## Schema Design

Current indexes defined:

### documents

- `by_owner` - [ownerId] - Owner's documents
- `by_folder` - [parentFolderId] - Documents in a folder
- `by_owner_deleted` - [ownerId, isDeleted] - Trash filtering
- `search_title` - Search index with filter fields

### folders

- `by_owner` - [ownerId]
- `by_parent` - [parentId]

### documentCollaborators

- `by_document` - [documentId]
- `by_user` - [userId]
- `by_document_user` - [documentId, userId] - Unique lookups

### documentVersions

- `by_document` - [documentId]

### userPresence

- `by_document` - [documentId]
- `by_user` - [userId]
- `by_document_user` - [documentId, userId]

### userPreferences

- `by_user` - [userId]

## Common Pitfalls to Avoid

1. **Using `throw new Error()`** → Always use `ConvexError` with codes
2. **Sequential awaits in loops** → Use `Promise.all` for independent operations
3. **Missing return validators** → Always define the `returns` field
4. **Not using indexes** → Use `withIndex()` instead of `filter()`
5. **Reading before patching** → Patch directly when possible
6. **Missing idempotency** → Design mutations to be safely retried

## File Organization

```
convex/
├── lib/
│   └── utils.ts          # Shared utilities
├── schema.ts             # Database schema
├── convex.config.ts      # App configuration
├── auth.ts               # Authentication
├── documents.ts          # Document CRUD
├── folders.ts            # Folder management
├── collaborators.ts      # Sharing & permissions
├── versions.ts           # Version history
├── userPreferences.ts    # User settings
├── presence.ts           # Real-time presence
├── realtime.ts           # Real-time document updates
├── http.ts               # HTTP routes
└── _generated/           # Auto-generated types
```

## Testing

Before deploying:

1. Run `npx convex dev` to test locally
2. Check that all queries use indexes properly
3. Verify error messages are user-friendly
4. Test mutations are idempotent

## Additional Resources

- [Convex Best Practices](https://docs.convex.dev/understanding/best-practices/)
- [Error Handling](https://docs.convex.dev/functions/error-handling)
- [Write Conflicts](https://docs.convex.dev/error#1)
- [Convex LLMs.txt](https://docs.convex.dev/llms.txt)

---

**Last Updated:** January 2026  
**Maintained by:** Development Team
