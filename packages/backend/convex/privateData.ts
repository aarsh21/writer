import { v } from "convex/values"

import { query } from "./_generated/server"

export const get = query({
	args: {},
	returns: v.object({
		message: v.string(),
	}),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity()
		if (identity === null) return { message: "Not authenticated" }
		return { message: "This is private" }
	},
})
