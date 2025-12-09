import { createClient, type GenericCtx } from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { crossDomain } from "@convex-dev/better-auth/plugins"
import { components } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import { query } from "./_generated/server"
import type { QueryCtx, MutationCtx } from "./_generated/server"
import { betterAuth } from "better-auth"
import { v } from "convex/values"

const siteUrl = process.env.SITE_URL!

// Frontend origins that are allowed to make cross-origin requests
const trustedOrigins = [
	siteUrl,
	"http://localhost:3001",
	"http://127.0.0.1:3001",
	"tauri://localhost", // Tauri app
	"https://tauri.localhost", // Tauri app (alternative)
].filter(Boolean)

export const authComponent = createClient<DataModel>(components.betterAuth)

/**
 * Safely get the authenticated user, returning null if not authenticated
 * Use this in queries that need to handle unauthenticated users gracefully
 */
export async function getAuthUserSafe(ctx: QueryCtx | MutationCtx) {
	try {
		return await authComponent.getAuthUser(ctx)
	} catch {
		return null
	}
}

function createAuth(
	ctx: GenericCtx<DataModel>,
	{ optionsOnly }: { optionsOnly?: boolean } = { optionsOnly: false },
) {
	return betterAuth({
		logger: {
			disabled: optionsOnly,
		},
		trustedOrigins,
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
		},
		plugins: [crossDomain({ siteUrl }), convex()],
	})
}

export { createAuth }

export const getCurrentUser = query({
	args: {},
	returns: v.any(),
	handler: async function (ctx, _args) {
		return getAuthUserSafe(ctx)
	},
})
