import { ConvexError } from "convex/values"

import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { getAuthUserSafe } from "../auth"

export async function getAuthenticatedUser(ctx: MutationCtx) {
	const user = await getAuthUserSafe(ctx)
	if (!user) {
		throw new ConvexError({
			code: "UNAUTHORIZED",
			message: "User not authenticated",
		})
	}
	return user
}

export async function checkDocumentAccess(
	ctx: QueryCtx | MutationCtx,
	documentId: Id<"documents">,
	userId: string,
	requiredRole: "viewer" | "editor" | "owner" = "viewer",
) {
	const document = await ctx.db.get(documentId)
	if (!document || document.isDeleted) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Document not found",
		})
	}

	if (document.ownerId === userId) return { document, role: "owner" as const }

	const collaborator = await ctx.db
		.query("documentCollaborators")
		.withIndex("by_document_user", (q) => q.eq("documentId", documentId).eq("userId", userId))
		.unique()

	if (!collaborator) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "You don't have access to this document",
		})
	}

	const roleHierarchy: Record<string, number> = { viewer: 0, editor: 1, owner: 2 }
	if (roleHierarchy[collaborator.role] < roleHierarchy[requiredRole]) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: `${requiredRole} role required`,
		})
	}

	return { document, role: collaborator.role }
}

export async function checkFolderAccess(
	ctx: QueryCtx | MutationCtx,
	folderId: Id<"folders">,
	userId: string,
) {
	const folder = await ctx.db.get(folderId)
	if (!folder) {
		throw new ConvexError({
			code: "NOT_FOUND",
			message: "Folder not found",
		})
	}
	if (folder.ownerId !== userId) {
		throw new ConvexError({
			code: "FORBIDDEN",
			message: "You don't own this folder",
		})
	}
	return folder
}

export const roleHierarchy: Record<string, number> = {
	viewer: 0,
	editor: 1,
	owner: 2,
}

export type UserRole = "viewer" | "editor" | "owner"

export function hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {
	return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}
