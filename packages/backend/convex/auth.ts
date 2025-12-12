import { createClient, type GenericCtx } from "@convex-dev/better-auth"
import { convex, crossDomain } from "@convex-dev/better-auth/plugins"
import { betterAuth } from "better-auth"
import { v } from "convex/values"

import { components } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import { query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"

const siteUrl = process.env.SITE_URL ?? ""

const trustedOrigins = [
	siteUrl,
	"http://localhost:3001",
	"http://127.0.0.1:3001",
	"tauri://localhost",
	"https://tauri.localhost",
].filter(Boolean)

export const authComponent = createClient<DataModel>(components.betterAuth)

export async function getAuthUserSafe(ctx: QueryCtx | MutationCtx) {
	return authComponent.getAuthUser(ctx).catch(() => null)
}

function createAuth(
	ctx: GenericCtx<DataModel>,
	options: { optionsOnly?: boolean } = { optionsOnly: false },
) {
	return betterAuth({
		logger: {
			disabled: options.optionsOnly,
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
	handler: async (ctx) => getAuthUserSafe(ctx),
})
