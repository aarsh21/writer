import { useEffect, useState, useCallback } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@writer/backend/convex/_generated/api"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import {
	CommandDialog,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command"
import { FileText, Plus, Settings, Moon, Sun, Home, Clock, Keyboard } from "lucide-react"
import { useTheme } from "@/components/theme-provider"

export function CommandPalette() {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState("")
	const navigate = useNavigate()
	const { theme, setTheme } = useTheme()
	const routerState = useRouterState()

	// Get documents for search
	const documents = useQuery(api.documents.listDocuments, {})
	const recentDocuments = useQuery(api.userPreferences.getRecentDocumentsWithData, { limit: 5 })
	const preferences = useQuery(api.userPreferences.getUserPreferences)
	const createDocument = useMutation(api.documents.createDocument)

	// Get configurable shortcuts with defaults
	const commandPaletteKey = preferences?.keyboardShortcuts?.commandPalette || "k"
	const newDocumentKey = preferences?.keyboardShortcuts?.newDocument || "n"

	// Keyboard shortcut to open command palette
	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === commandPaletteKey && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				setOpen((open) => !open)
			}
			// New document shortcut
			if (e.key === newDocumentKey && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				handleCreateDocument()
			}
		}

		document.addEventListener("keydown", down)
		return () => document.removeEventListener("keydown", down)
	}, [commandPaletteKey, newDocumentKey])

	// Reset search when dialog closes
	useEffect(() => {
		if (!open) {
			setSearch("")
		}
	}, [open])

	const runCommand = useCallback((command: () => void) => {
		setOpen(false)
		command()
	}, [])

	const handleCreateDocument = async () => {
		const docId = await createDocument({})
		navigate({ to: "/documents/$documentId", params: { documentId: docId } })
	}

	const handleNavigateToDocument = (documentId: string) => {
		navigate({ to: "/documents/$documentId", params: { documentId } })
	}

	const handleToggleTheme = () => {
		setTheme(theme === "dark" ? "light" : "dark")
	}

	// Filter documents based on search
	const filteredDocuments = documents?.filter((doc) =>
		doc.title.toLowerCase().includes(search.toLowerCase()),
	)

	// Format shortcut for display
	const formatShortcut = (key: string) => `⌘${key.toUpperCase()}`

	return (
		<CommandDialog open={open} onOpenChange={setOpen} showCloseButton={false}>
			<CommandInput
				placeholder="Type a command or search documents..."
				value={search}
				onValueChange={setSearch}
			/>
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>

				{/* Quick Actions */}
				<CommandGroup heading="Quick Actions">
					<CommandItem onSelect={() => runCommand(handleCreateDocument)}>
						<Plus className="mr-2 h-4 w-4" />
						Create New Document
						<CommandShortcut>{formatShortcut(newDocumentKey)}</CommandShortcut>
					</CommandItem>
					<CommandItem onSelect={() => runCommand(() => navigate({ to: "/" }))}>
						<Home className="mr-2 h-4 w-4" />
						Go to Dashboard
					</CommandItem>
					<CommandItem onSelect={() => runCommand(handleToggleTheme)}>
						{theme === "dark" ? (
							<Sun className="mr-2 h-4 w-4" />
						) : (
							<Moon className="mr-2 h-4 w-4" />
						)}
						Toggle {theme === "dark" ? "Light" : "Dark"} Mode
					</CommandItem>
				</CommandGroup>

				<CommandSeparator />

				{/* Recent Documents */}
				{recentDocuments && recentDocuments.length > 0 && !search && (
					<>
						<CommandGroup heading="Recent Documents">
							{recentDocuments.slice(0, 5).map((doc) => (
								<CommandItem
									key={doc._id}
									onSelect={() => runCommand(() => handleNavigateToDocument(doc._id))}
								>
									<Clock className="mr-2 h-4 w-4" />
									<span className="flex-1 truncate">{doc.title || "Untitled"}</span>
								</CommandItem>
							))}
						</CommandGroup>
						<CommandSeparator />
					</>
				)}

				{/* Search Results */}
				{search && filteredDocuments && filteredDocuments.length > 0 && (
					<CommandGroup heading="Documents">
						{filteredDocuments.slice(0, 10).map((doc) => (
							<CommandItem
								key={doc._id}
								onSelect={() => runCommand(() => handleNavigateToDocument(doc._id))}
							>
								<FileText className="mr-2 h-4 w-4" />
								<span className="flex-1 truncate">{doc.title || "Untitled"}</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				<CommandSeparator />

				{/* Navigation */}
				<CommandGroup heading="Navigation">
					<CommandItem onSelect={() => runCommand(() => navigate({ to: "/" }))}>
						<Home className="mr-2 h-4 w-4" />
						Dashboard
					</CommandItem>
					<CommandItem onSelect={() => runCommand(() => navigate({ to: "/settings" }))}>
						<Settings className="mr-2 h-4 w-4" />
						Settings
					</CommandItem>
				</CommandGroup>

				{/* Keyboard Shortcuts Info */}
				<CommandSeparator />
				<CommandGroup heading="Keyboard Shortcuts">
					<CommandItem disabled className="opacity-60">
						<Keyboard className="mr-2 h-4 w-4" />
						<span className="flex-1">Open Command Palette</span>
						<CommandShortcut>{formatShortcut(commandPaletteKey)}</CommandShortcut>
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	)
}
