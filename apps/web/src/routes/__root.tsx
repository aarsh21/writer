import Header from "@/components/header"
import { ThemeProvider } from "@/components/theme-provider"
import { CommandPalette } from "@/components/command-palette"
import { Toaster } from "@/components/ui/sonner"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import {
	HeadContent,
	Outlet,
	createRootRouteWithContext,
	useRouterState,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react"
import { useState } from "react"
import SignInForm from "@/components/sign-in-form"
import SignUpForm from "@/components/sign-up-form"
import "../index.css"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RouterAppContext {}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "Writer",
			},
			{
				name: "description",
				content: "A collaborative document editor",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
})

function RootComponent() {
	const routerState = useRouterState()
	const currentPath = routerState.location.pathname

	// Routes that use the sidebar layout (authenticated app routes)
	// "/" is the main dashboard, along with /documents and /settings
	const useSidebarLayout =
		currentPath === "/" ||
		currentPath.startsWith("/documents") ||
		currentPath.startsWith("/settings")

	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				{useSidebarLayout ? (
					<div className="h-svh">
						<AuthenticatedLayout />
					</div>
				) : (
					<div className="grid h-svh grid-rows-[auto_1fr]">
						<Header />
						<Outlet />
					</div>
				)}
				<CommandPalette />
				<Toaster richColors />
			</ThemeProvider>
			<TanStackRouterDevtools position="bottom-left" />
		</>
	)
}

function AuthenticatedLayout() {
	const [showSignIn, setShowSignIn] = useState(false)

	return (
		<>
			<Authenticated>
				<SidebarProvider>
					<AppSidebar />
					<SidebarInset>
						<Outlet />
					</SidebarInset>
				</SidebarProvider>
			</Authenticated>
			<Unauthenticated>
				<div className="bg-background flex h-full items-center justify-center p-4">
					{showSignIn ? (
						<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
					) : (
						<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
					)}
				</div>
			</Unauthenticated>
			<AuthLoading>
				<div className="flex h-full items-center justify-center">
					<div className="text-muted-foreground">Loading...</div>
				</div>
			</AuthLoading>
		</>
	)
}
