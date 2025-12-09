import { useState } from "react"
import { useAction } from "convex/react"
import { api } from "@writer/backend/convex/_generated/api"
import type { GenericId } from "convex/values"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Download, FileText, Code, FileJson, FileType } from "lucide-react"
import { toast } from "sonner"

type DocumentId = GenericId<"documents">
type ExportFormat = "markdown" | "html" | "text" | "json"

interface ExportDocumentDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	documentId: DocumentId
	documentTitle: string
}

const exportFormats: Array<{
	value: ExportFormat
	label: string
	description: string
	icon: React.ComponentType<{ className?: string }>
	extension: string
	mimeType: string
}> = [
	{
		value: "markdown",
		label: "Markdown",
		description: "Plain text with formatting syntax",
		icon: FileText,
		extension: ".md",
		mimeType: "text/markdown",
	},
	{
		value: "html",
		label: "HTML",
		description: "Web page with styles",
		icon: Code,
		extension: ".html",
		mimeType: "text/html",
	},
	{
		value: "text",
		label: "Plain Text",
		description: "Simple text without formatting",
		icon: FileType,
		extension: ".txt",
		mimeType: "text/plain",
	},
	{
		value: "json",
		label: "JSON",
		description: "Tiptap document format",
		icon: FileJson,
		extension: ".json",
		mimeType: "application/json",
	},
]

export function ExportDocumentDialog({
	open,
	onOpenChange,
	documentId,
	documentTitle,
}: ExportDocumentDialogProps) {
	const [format, setFormat] = useState<ExportFormat>("markdown")
	const [isExporting, setIsExporting] = useState(false)

	const exportToMarkdown = useAction(api.exports.exportToMarkdown)
	const exportToHTML = useAction(api.exports.exportToHTML)
	const exportToText = useAction(api.exports.exportToText)
	const exportToJSON = useAction(api.exports.exportToJSON)

	const handleExport = async () => {
		setIsExporting(true)
		try {
			let result: { title: string; content: string; format: string }

			switch (format) {
				case "markdown":
					result = await exportToMarkdown({ documentId })
					break
				case "html":
					result = await exportToHTML({ documentId, includeStyles: true })
					break
				case "text":
					result = await exportToText({ documentId })
					break
				case "json":
					result = await exportToJSON({ documentId })
					break
				default:
					throw new Error("Invalid format")
			}

			// Find format config
			const formatConfig = exportFormats.find((f) => f.value === format)!

			// Create and download file
			const blob = new Blob([result.content], { type: formatConfig.mimeType })
			const url = URL.createObjectURL(blob)
			const a = document.createElement("a")
			a.href = url
			a.download = `${sanitizeFilename(result.title)}${formatConfig.extension}`
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			URL.revokeObjectURL(url)

			toast.success(`Exported as ${formatConfig.label}`)
			onOpenChange(false)
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to export document")
		} finally {
			setIsExporting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Download className="h-5 w-5" />
						Export Document
					</DialogTitle>
					<DialogDescription>Choose a format to export "{documentTitle}".</DialogDescription>
				</DialogHeader>

				<div className="py-4">
					<Label className="mb-3 block">Export Format</Label>
					<RadioGroup
						value={format}
						onValueChange={(v) => setFormat(v as ExportFormat)}
						className="grid gap-3"
					>
						{exportFormats.map((fmt) => {
							const Icon = fmt.icon
							return (
								<Label
									key={fmt.value}
									htmlFor={fmt.value}
									className="border-border hover:bg-accent/50 data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors"
								>
									<RadioGroupItem value={fmt.value} id={fmt.value} />
									<Icon className="text-muted-foreground h-5 w-5" />
									<div className="flex-1">
										<div className="font-medium">{fmt.label}</div>
										<div className="text-muted-foreground text-sm">{fmt.description}</div>
									</div>
									<span className="text-muted-foreground text-sm">{fmt.extension}</span>
								</Label>
							)
						})}
					</RadioGroup>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleExport} disabled={isExporting} className="gap-2">
						<Download className="h-4 w-4" />
						{isExporting ? "Exporting..." : "Export"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

function sanitizeFilename(filename: string): string {
	return filename
		.replace(/[<>:"/\\|?*]/g, "")
		.replace(/\s+/g, "_")
		.slice(0, 100)
}
