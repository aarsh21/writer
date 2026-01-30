import { useEffect, useState, useCallback } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@writer/backend/convex/_generated/api"
import type { Id } from "@writer/backend/convex/_generated/dataModel"
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
import { Plus, Settings, Moon, Sun, Home, Clock, Keyboard, Search } from "lucide-react"
import { useTheme } from "@/components/theme-provider"

// Debounce hook for search
function useDebouncedValue<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value)

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedValue(value), delay)
		return () => clearTimeout(timer)
	}, [value, delay])

	return debouncedValue
}

export function CommandPalette() {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState("")
	const debouncedSearch = useDebouncedValue(search, 150)
	const navigate = useNavigate()
	const { theme, setTheme } = useTheme()
	const routerState = useRouterState()
	const currentPath = routerState.location.pathname

	// Get current document ID from URL to determine folder context
	const documentIdMatch = currentPath.match(/^\/documents\/(.+)$/)
	const currentDocumentId = documentIdMatch ? (documentIdMatch[1] as Id<"documents">) : undefined

	// Get current document to know its folder
	const currentDocument = useQuery(
		api.documents.getDocument,
		currentDocumentId ? { documentId: currentDocumentId } : "skip",
	)

	// Get documents for search - use full-text search when query exists
	const searchResults = useQuery(
		api.documents.searchDocuments,
		debouncedSearch.trim() ? { searchQuery: debouncedSearch.trim() } : "skip",
	)
	const recentDocuments = useQuery(api.userPreferences.getRecentDocumentsWithData, { limit: 5 })
	const preferences = useQuery(api.userPreferences.getUserPreferences)
	const createDocument = useMutation(api.documents.createDocument)

	// Get configurable shortcuts with defaults
	const commandPaletteKey = preferences?.keyboardShortcuts?.commandPalette || "k"
	const newDocumentKey = preferences?.keyboardShortcuts?.newDocument || "n"

	const runCommand = useCallback((command: () => void) => {
		setOpen(false)
		command()
	}, [])

	// Create document in current folder context
	const handleCreateDocument = useCallback(async () => {
		const folderId = currentDocument?.parentFolderId
		const docId = await createDocument({ parentFolderId: folderId })
		navigate({ to: "/documents/$documentId", params: { documentId: docId } })
	}, [createDocument, navigate, currentDocument?.parentFolderId])

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
	}, [commandPaletteKey, newDocumentKey, handleCreateDocument])

	// Reset search when dialog closes
	useEffect(() => {
		if (!open) {
			setSearch("")
		}
	}, [open])

	const handleNavigateToDocument = (documentId: string) => {
		navigate({ to: "/documents/$documentId", params: { documentId } })
	}

	const handleToggleTheme = () => {
		setTheme(theme === "dark" ? "light" : "dark")
	}

	// Format shortcut for display
	const formatShortcut = (key: string) => `⌘${key.toUpperCase()}`

	// Check if we're actively searching
	const isSearching = search.trim().length > 0

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
						New Document
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
				{recentDocuments && recentDocuments.length > 0 && !isSearching && (
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
				{isSearching && searchResults && searchResults.length > 0 && (
					<CommandGroup heading="Search Results">
						{searchResults.slice(0, 10).map((doc) => (
							<CommandItem
								key={doc._id}
								onSelect={() => runCommand(() => handleNavigateToDocument(doc._id))}
							>
								<Search className="mr-2 h-4 w-4" />
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
