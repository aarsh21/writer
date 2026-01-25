import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "@writer/backend/convex/_generated/api"
import { useState } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Kbd } from "@/components/ui/kbd"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { User, Settings, Keyboard, Type, LogOut, Copy, Check } from "lucide-react"
import { useTheme } from "@/components/theme-provider"

export const Route = createFileRoute("/settings")({
	component: SettingsContent,
})

function SettingsContent() {
	const navigate = useNavigate()
	const user = useQuery(api.auth.getCurrentUser)
	const preferences = useQuery(api.userPreferences.getUserPreferences)
	const updatePreferences = useMutation(api.userPreferences.updateUserPreferences)
	const updateShortcuts = useMutation(api.userPreferences.updateKeyboardShortcuts)
	const { theme, setTheme } = useTheme()

	const [copiedUserId, setCopiedUserId] = useState(false)

	const handleCopyUserId = async () => {
		if (preferences?.userId) {
			await navigator.clipboard.writeText(preferences.userId)
			setCopiedUserId(true)
			toast.success("User ID copied to clipboard")
			setTimeout(() => setCopiedUserId(false), 2000)
		}
	}

	const handleSignOut = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					navigate({ to: "/" })
				},
			},
		})
	}

	const handleFontSizeChange = async (value: number[]) => {
		await updatePreferences({ editorFontSize: value[0] })
	}

	const handleLineHeightChange = async (value: number[]) => {
		await updatePreferences({ editorLineHeight: value[0] })
	}

	const handleShortcutChange = async (key: string, value: string) => {
		// Validate: only single letter keys allowed
		const cleanValue = value.toLowerCase().slice(0, 1)
		if (!/^[a-z]$/.test(cleanValue) && cleanValue !== "") return

		await updateShortcuts({ [key]: cleanValue || undefined })
		toast.success("Shortcut updated")
	}

	return (
		<>
			<header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="mr-2 h-4" />
				<Settings className="h-4 w-4" />
				<h1 className="text-lg font-semibold">Settings</h1>
			</header>
			<main className="flex-1 overflow-auto p-6">
				<div className="mx-auto max-w-2xl space-y-6">
					{/* User Profile */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<User className="h-5 w-5" />
								Profile
							</CardTitle>
							<CardDescription>Your account information</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-2">
								<Label>Username</Label>
								<div className="text-foreground">{user?.username || "Not set"}</div>
							</div>
							<div className="grid gap-2">
								<Label>Email</Label>
								<div className="text-foreground">{user?.email || "Not set"}</div>
							</div>
							<div className="grid gap-2">
								<Label>User ID</Label>
								<div className="flex items-center gap-2">
									<code className="bg-muted flex-1 truncate rounded px-2 py-1 text-sm">
										{preferences?.userId || "Loading..."}
									</code>
									<Button
										variant="outline"
										size="icon"
										onClick={handleCopyUserId}
										className="h-8 w-8"
									>
										{copiedUserId ? (
											<Check className="h-4 w-4 text-green-500" />
										) : (
											<Copy className="h-4 w-4" />
										)}
									</Button>
								</div>
								<p className="text-muted-foreground text-xs">
									Share this ID with others to collaborate on documents
								</p>
							</div>
							<Separator />
							<Button variant="destructive" onClick={handleSignOut} className="gap-2">
								<LogOut className="h-4 w-4" />
								Sign Out
							</Button>
						</CardContent>
					</Card>

					{/* Appearance */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Type className="h-5 w-5" />
								Appearance
							</CardTitle>
							<CardDescription>Customize the look and feel</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="grid gap-2">
								<Label>Theme</Label>
								<Select value={theme} onValueChange={setTheme}>
									<SelectTrigger className="w-48">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="light">Light</SelectItem>
										<SelectItem value="dark">Dark</SelectItem>
										<SelectItem value="system">System</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<div className="flex items-center justify-between">
									<Label>Editor Font Size</Label>
									<Badge variant="secondary">{preferences?.editorFontSize || 16}px</Badge>
								</div>
								<Slider
									value={[preferences?.editorFontSize || 16]}
									onValueCommit={handleFontSizeChange}
									min={12}
									max={24}
									step={1}
									className="w-full"
								/>
							</div>
							<div className="grid gap-2">
								<div className="flex items-center justify-between">
									<Label>Line Height</Label>
									<Badge variant="secondary">{preferences?.editorLineHeight || 1.6}</Badge>
								</div>
								<Slider
									value={[preferences?.editorLineHeight || 1.6]}
									onValueCommit={handleLineHeightChange}
									min={1.2}
									max={2.0}
									step={0.1}
									className="w-full"
								/>
							</div>
						</CardContent>
					</Card>

					{/* Keyboard Shortcuts */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Keyboard className="h-5 w-5" />
								Keyboard Shortcuts
							</CardTitle>
							<CardDescription>
								Customize keyboard shortcuts. All shortcuts use Cmd/Ctrl + key.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<ShortcutInput
								label="Toggle Sidebar"
								value={preferences?.keyboardShortcuts?.toggleSidebar || "b"}
								onChange={(v) => handleShortcutChange("toggleSidebar", v)}
							/>
							<ShortcutInput
								label="Command Palette"
								value={preferences?.keyboardShortcuts?.commandPalette || "k"}
								onChange={(v) => handleShortcutChange("commandPalette", v)}
							/>
							<ShortcutInput
								label="New Document"
								value={preferences?.keyboardShortcuts?.newDocument || "n"}
								onChange={(v) => handleShortcutChange("newDocument", v)}
							/>
						</CardContent>
					</Card>
				</div>
			</main>
		</>
	)
}

function ShortcutInput({
	label,
	value,
	onChange,
}: {
	label: string
	value: string
	onChange: (value: string) => void
}) {
	const [editing, setEditing] = useState(false)
	const [inputValue, setInputValue] = useState(value)

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		e.preventDefault()
		const key = e.key.toLowerCase()
		if (/^[a-z]$/.test(key)) {
			setInputValue(key)
			onChange(key)
			setEditing(false)
		} else if (e.key === "Escape") {
			setInputValue(value)
			setEditing(false)
		}
	}

	return (
		<div className="flex items-center justify-between">
			<Label>{label}</Label>
			<div className="flex items-center gap-2">
				<Kbd className="text-muted-foreground">Cmd/Ctrl</Kbd>
				<span className="text-muted-foreground">+</span>
				{editing ? (
					<Input
						className="h-8 w-12 text-center uppercase"
						value={inputValue}
						onKeyDown={handleKeyDown}
						onBlur={() => {
							setInputValue(value)
							setEditing(false)
						}}
						autoFocus
						maxLength={1}
					/>
				) : (
					<Button
						variant="outline"
						size="sm"
						className="h-8 w-12 uppercase"
						onClick={() => setEditing(true)}
					>
						{value}
					</Button>
				)}
			</div>
		</div>
	)
}
