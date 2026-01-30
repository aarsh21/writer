"use node"

import { ConvexError, v } from "convex/values"

import { api } from "./_generated/api"
import { action } from "./_generated/server"

interface DocumentResult {
	_id: string
	title: string
	content: string
	ownerId: string
	createdAt: number
	updatedAt: number
}

interface TiptapNode {
	type: string
	content?: TiptapNode[]
	text?: string
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
	attrs?: Record<string, unknown>
}

function nodeToMarkdown(node: TiptapNode, depth = 0): string {
	if (!node) return ""

	switch (node.type) {
		case "doc":
			return (node.content ?? []).map((n) => nodeToMarkdown(n)).join("\n\n")

		case "paragraph":
			return (node.content ?? []).map((n) => nodeToMarkdown(n)).join("")

		case "heading": {
			const level = (node.attrs?.level as number) ?? 1
			const prefix = "#".repeat(level)
			const content = (node.content ?? []).map((n) => nodeToMarkdown(n)).join("")
			return `${prefix} ${content}`
		}

		case "bulletList":
			return (node.content ?? []).map((n) => nodeToMarkdown(n, depth)).join("\n")

		case "orderedList":
			return (node.content ?? [])
				.map((n, i) => {
					const content = nodeToMarkdown(n, depth)
					return content.replace(/^- /, `${i + 1}. `)
				})
				.join("\n")

		case "listItem": {
			const indent = "  ".repeat(depth)
			const content = (node.content ?? []).map((n) => nodeToMarkdown(n)).join("")
			return `${indent}- ${content}`
		}

		case "taskList":
			return (node.content ?? []).map((n) => nodeToMarkdown(n, depth)).join("\n")

		case "taskItem": {
			const indent = "  ".repeat(depth)
			const checked = node.attrs?.checked ? "x" : " "
			const content = (node.content ?? []).map((n) => nodeToMarkdown(n)).join("")
			return `${indent}- [${checked}] ${content}`
		}

		case "codeBlock": {
			const lang = (node.attrs?.language as string) ?? ""
			const content = (node.content ?? []).map((n) => nodeToMarkdown(n)).join("")
			return `\`\`\`${lang}\n${content}\n\`\`\``
		}

		case "blockquote": {
			const content = (node.content ?? []).map((n) => nodeToMarkdown(n)).join("")
			return content
				.split("\n")
				.map((line) => `> ${line}`)
				.join("\n")
		}

		case "horizontalRule":
			return "---"

		case "hardBreak":
			return "\n"

		case "text": {
			let text = node.text ?? ""
			for (const mark of node.marks ?? []) {
				switch (mark.type) {
					case "bold":
						text = `**${text}**`
						break
					case "italic":
						text = `*${text}*`
						break
					case "strike":
						text = `~~${text}~~`
						break
					case "code":
						text = `\`${text}\``
						break
					case "link":
						text = `[${text}](${(mark.attrs?.href as string) ?? ""})`
						break
				}
			}
			return text
		}

		default:
			return (node.content ?? []).map((n) => nodeToMarkdown(n)).join("")
	}
}

function tiptapToMarkdown(jsonContent: string): string {
	const doc = JSON.parse(jsonContent) as TiptapNode
	return nodeToMarkdown(doc)
}

function escapeHTML(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;")
}

function nodeToHTML(node: TiptapNode): string {
	if (!node) return ""

	switch (node.type) {
		case "doc":
			return (node.content ?? []).map((n) => nodeToHTML(n)).join("")

		case "paragraph":
			return `<p>${(node.content ?? []).map((n) => nodeToHTML(n)).join("")}</p>`

		case "heading": {
			const level = (node.attrs?.level as number) ?? 1
			const content = (node.content ?? []).map((n) => nodeToHTML(n)).join("")
			return `<h${level}>${content}</h${level}>`
		}

		case "bulletList":
			return `<ul>${(node.content ?? []).map((n) => nodeToHTML(n)).join("")}</ul>`

		case "orderedList":
			return `<ol>${(node.content ?? []).map((n) => nodeToHTML(n)).join("")}</ol>`

		case "listItem":
			return `<li>${(node.content ?? []).map((n) => nodeToHTML(n)).join("")}</li>`

		case "taskList":
			return `<ul class="task-list">${(node.content ?? []).map((n) => nodeToHTML(n)).join("")}</ul>`

		case "taskItem": {
			const checked = node.attrs?.checked ? "checked" : ""
			const content = (node.content ?? []).map((n) => nodeToHTML(n)).join("")
			return `<li><input type="checkbox" ${checked} disabled> ${content}</li>`
		}

		case "codeBlock": {
			const lang = (node.attrs?.language as string) ?? ""
			const content = (node.content ?? []).map((n) => nodeToHTML(n)).join("")
			return `<pre><code class="language-${lang}">${escapeHTML(content)}</code></pre>`
		}

		case "blockquote":
			return `<blockquote>${(node.content ?? []).map((n) => nodeToHTML(n)).join("")}</blockquote>`

		case "horizontalRule":
			return "<hr>"

		case "hardBreak":
			return "<br>"

		case "text": {
			let text = escapeHTML(node.text ?? "")
			for (const mark of node.marks ?? []) {
				switch (mark.type) {
					case "bold":
						text = `<strong>${text}</strong>`
						break
					case "italic":
						text = `<em>${text}</em>`
						break
					case "strike":
						text = `<s>${text}</s>`
						break
					case "code":
						text = `<code>${text}</code>`
						break
					case "underline":
						text = `<u>${text}</u>`
						break
					case "link":
						text = `<a href="${escapeHTML((mark.attrs?.href as string) ?? "")}">${text}</a>`
						break
				}
			}
			return text
		}

		default:
			return (node.content ?? []).map((n) => nodeToHTML(n)).join("")
	}
}

function tiptapToHTML(jsonContent: string, includeStyles: boolean): string {
	const doc = JSON.parse(jsonContent) as TiptapNode
	const body = nodeToHTML(doc)

	if (includeStyles) {
		return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
p { margin: 1em 0; }
ul, ol { padding-left: 2em; }
blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #666; }
code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
pre { background: #f4f4f4; padding: 1em; border-radius: 5px; overflow-x: auto; }
pre code { background: none; padding: 0; }
a { color: #0066cc; }
hr { border: none; border-top: 1px solid #ccc; margin: 2em 0; }
</style>
</head>
<body>
${body}
</body>
</html>`
	}

	return body
}

function nodeToText(node: TiptapNode): string {
	if (!node) return ""

	switch (node.type) {
		case "doc":
			return (node.content ?? []).map((n) => nodeToText(n)).join("\n\n")

		case "paragraph":
			return (node.content ?? []).map((n) => nodeToText(n)).join("")

		case "heading":
			return (node.content ?? []).map((n) => nodeToText(n)).join("")

		case "bulletList":
		case "orderedList":
		case "taskList":
			return (node.content ?? []).map((n) => nodeToText(n)).join("\n")

		case "listItem":
		case "taskItem":
			return `• ${(node.content ?? []).map((n) => nodeToText(n)).join("")}`

		case "codeBlock":
			return (node.content ?? []).map((n) => nodeToText(n)).join("")

		case "blockquote":
			return (node.content ?? []).map((n) => nodeToText(n)).join("")

		case "horizontalRule":
			return "---"

		case "hardBreak":
			return "\n"

		case "text":
			return node.text ?? ""

		default:
			return (node.content ?? []).map((n) => nodeToText(n)).join("")
	}
}

function tiptapToText(jsonContent: string): string {
	const doc = JSON.parse(jsonContent) as TiptapNode
	return nodeToText(doc)
}

export const exportToMarkdown = action({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.object({
		title: v.string(),
		content: v.string(),
		format: v.literal("markdown"),
	}),
	handler: async (ctx, args): Promise<{ title: string; content: string; format: "markdown" }> => {
		const document: DocumentResult | null = await ctx.runQuery(api.documents.getDocument, {
			documentId: args.documentId,
		})

		if (!document) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Document not found or access denied",
			})
		}

		return {
			title: document.title,
			content: tiptapToMarkdown(document.content),
			format: "markdown" as const,
		}
	},
})

export const exportToHTML = action({
	args: {
		documentId: v.id("documents"),
		includeStyles: v.optional(v.boolean()),
	},
	returns: v.object({
		title: v.string(),
		content: v.string(),
		format: v.literal("html"),
	}),
	handler: async (ctx, args): Promise<{ title: string; content: string; format: "html" }> => {
		const document: DocumentResult | null = await ctx.runQuery(api.documents.getDocument, {
			documentId: args.documentId,
		})

		if (!document) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Document not found or access denied",
			})
		}

		return {
			title: document.title,
			content: tiptapToHTML(document.content, args.includeStyles ?? true),
			format: "html" as const,
		}
	},
})

export const exportToText = action({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.object({
		title: v.string(),
		content: v.string(),
		format: v.literal("text"),
	}),
	handler: async (ctx, args): Promise<{ title: string; content: string; format: "text" }> => {
		const document: DocumentResult | null = await ctx.runQuery(api.documents.getDocument, {
			documentId: args.documentId,
		})

		if (!document) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Document not found or access denied",
			})
		}

		return {
			title: document.title,
			content: tiptapToText(document.content),
			format: "text" as const,
		}
	},
})

export const exportToJSON = action({
	args: {
		documentId: v.id("documents"),
	},
	returns: v.object({
		title: v.string(),
		content: v.string(),
		format: v.literal("json"),
	}),
	handler: async (ctx, args): Promise<{ title: string; content: string; format: "json" }> => {
		const document: DocumentResult | null = await ctx.runQuery(api.documents.getDocument, {
			documentId: args.documentId,
		})

		if (!document) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Document not found or access denied",
			})
		}

		return {
			title: document.title,
			content: document.content,
			format: "json" as const,
		}
	},
})
