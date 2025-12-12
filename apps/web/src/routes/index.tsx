import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { api } from "@writer/backend/convex/_generated/api"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { FileText, Plus, Clock } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/")({
	component: DashboardContent,
})

function DashboardContent() {
	const documents = useQuery(api.documents.listDocuments, {})
	const recentDocuments = useQuery(api.userPreferences.getRecentDocumentsWithData, { limit: 5 })
	const createDocument = useMutation(api.documents.createDocument)
	const navigate = useNavigate()

	const handleCreateDocument = async () => {
		const docId = await createDocument({})
		navigate({ to: "/documents/$documentId", params: { documentId: docId } })
	}

	return (
		<>
			<header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="mr-2 h-4" />
				<h1 className="text-lg font-semibold">Dashboard</h1>
			</header>
			<main className="flex-1 overflow-auto p-6">
				{documents === undefined ? (
					<DashboardSkeleton />
				) : documents.length === 0 ? (
					<EmptyState onCreateDocument={handleCreateDocument} />
				) : (
					<DocumentsOverview
						documents={documents}
						recentDocuments={recentDocuments}
						onCreateDocument={handleCreateDocument}
					/>
				)}
			</main>
		</>
	)
}

function EmptyState({ onCreateDocument }: { onCreateDocument: () => void }) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-6">
			<div className="bg-muted flex h-20 w-20 items-center justify-center rounded-full">
				<FileText className="text-muted-foreground h-10 w-10" />
			</div>
			<div className="text-center">
				<h2 className="text-xl font-semibold">No documents yet</h2>
				<p className="text-muted-foreground mt-1">Create your first document to get started</p>
			</div>
			<Button size="lg" className="gap-2" onClick={onCreateDocument}>
				<Plus className="h-4 w-4" />
				Create Document
			</Button>
		</div>
	)
}

interface Document {
	_id: string
	title: string
	updatedAt: number
	createdAt: number
}

function DocumentsOverview({
	documents,
	recentDocuments,
	onCreateDocument,
}: {
	documents: Document[]
	recentDocuments: Document[] | undefined
	onCreateDocument: () => void
}) {
	const navigate = useNavigate()

	return (
		<div className="space-y-8">
			{/* Quick Actions */}
			<div className="flex items-center gap-4">
				<Button className="gap-2" onClick={onCreateDocument}>
					<Plus className="h-4 w-4" />
					New Document
				</Button>
			</div>

			{/* Recent Documents */}
			{recentDocuments && recentDocuments.length > 0 && (
				<section>
					<div className="mb-4 flex items-center gap-2">
						<Clock className="text-muted-foreground h-4 w-4" />
						<h2 className="font-semibold">Recent Documents</h2>
					</div>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{recentDocuments.map((doc) => (
							<DocumentCard
								key={doc._id}
								document={doc}
								onClick={() =>
									navigate({ to: "/documents/$documentId", params: { documentId: doc._id } })
								}
							/>
						))}
					</div>
				</section>
			)}

			{/* All Documents */}
			<section>
				<div className="mb-4 flex items-center gap-2">
					<FileText className="text-muted-foreground h-4 w-4" />
					<h2 className="font-semibold">All Documents</h2>
					<span className="text-muted-foreground text-sm">({documents.length})</span>
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{documents.map((doc) => (
						<DocumentCard
							key={doc._id}
							document={doc}
							onClick={() =>
								navigate({ to: "/documents/$documentId", params: { documentId: doc._id } })
							}
						/>
					))}
				</div>
			</section>
		</div>
	)
}

function DocumentCard({ document, onClick }: { document: Document; onClick: () => void }) {
	const formattedDate = new Date(document.updatedAt).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	})

	return (
		<button
			type="button"
			onClick={onClick}
			className="bg-card hover:bg-accent border-border flex flex-col gap-3 rounded-lg border p-4 text-left transition-colors"
		>
			<div className="bg-muted flex h-24 items-center justify-center rounded-md">
				<FileText className="text-muted-foreground h-8 w-8" />
			</div>
			<div className="min-w-0">
				<h3 className="truncate font-medium">{document.title || "Untitled"}</h3>
				<p className="text-muted-foreground text-sm">{formattedDate}</p>
			</div>
		</button>
	)
}

function DashboardSkeleton() {
	return (
		<div className="space-y-8">
			<Skeleton className="h-10 w-40" />
			<div>
				<Skeleton className="mb-4 h-6 w-48" />
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="space-y-3">
							<Skeleton className="h-24 w-full rounded-md" />
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-1/2" />
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
