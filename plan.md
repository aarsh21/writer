# Writer - Collaborative Document Editor

A Google Docs alternative desktop app with real-time collaborative sync, built with Tiptap, Convex, and shadcn/ui.

---

## Tech Stack

- **Frontend**: React + TanStack Router + Tauri (Desktop)
- **Editor**: Tiptap (ProseMirror-based)
- **Backend**: Convex (Real-time database + serverless functions)
- **Auth**: Better Auth (already configured)
- **UI**: shadcn/ui components (already installed)
- **Styling**: Tailwind CSS v4

---

## Available shadcn Components

We have these components ready to use:

| Component       | Use Case                            |
| --------------- | ----------------------------------- |
| `sidebar`       | Document list sidebar               |
| `dialog`        | Create/rename document modals       |
| `dropdown-menu` | Document actions, user menu         |
| `button`        | All actions                         |
| `input`         | Document title, search              |
| `textarea`      | Editor fallback                     |
| `avatar`        | User presence indicators            |
| `badge`         | Document status, collaborator count |
| `tooltip`       | Toolbar hints                       |
| `separator`     | UI divisions                        |
| `scroll-area`   | Document list scrolling             |
| `skeleton`      | Loading states                      |
| `tabs`          | Document tabs                       |
| `popover`       | Color picker, link editor           |
| `command`       | Command palette (Cmd+K)             |
| `alert-dialog`  | Delete confirmations                |
| `sheet`         | Mobile sidebar                      |
| `toggle`        | Toolbar buttons                     |
| `toggle-group`  | Text alignment                      |
| `context-menu`  | Right-click menus                   |
| `resizable`     | Sidebar resize                      |
| `card`          | Document cards in grid view         |
| `breadcrumb`    | Document path navigation            |
| `kbd`           | Keyboard shortcuts                  |

---

## App Layout & Design

### Color Scheme (Using shadcn theme variables)

- **Background**: `bg-background` (dark: oklch(0.1448 0 0))
- **Sidebar**: `bg-sidebar` (dark: oklch(0.2046 0 0))
- **Cards**: `bg-card` (dark: oklch(0.2134 0 0))
- **Borders**: `border-border` (dark: oklch(0.3407 0 0))
- **Accent**: `bg-accent` (dark: oklch(0.3715 0 0))

### Layout Structure

```
+--------------------------------------------------+
|  Header (logo, search, user menu)                |
+------------------+-------------------------------+
|                  |                               |
|  Sidebar         |  Editor Area                  |
|  - Documents     |  - Toolbar                    |
|  - Folders       |  - Document Title             |
|  - Recent        |  - Tiptap Editor              |
|                  |  - Collaborator Cursors       |
|                  |                               |
+------------------+-------------------------------+
```

---

## Feature Tasks

### Frontend Tasks

#### F1: Project Setup & Dependencies

- [ ] Install Tiptap packages: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-*`
- [ ] Install Yjs for collaboration: `yjs`, `y-protocols`
- [ ] Install additional utilities: `lucide-react` icons (if not present)
- [ ] Configure Tiptap CSS styles for editor

#### F2: App Shell Layout

- [ ] Create main layout with `Resizable` panels (sidebar + editor)
- [ ] Implement collapsible sidebar using `Sidebar` component
- [ ] Add responsive design with `Sheet` for mobile sidebar
- [ ] Use `bg-background` for main area, `bg-sidebar` for sidebar
- [ ] Add smooth transitions between views

#### F3: Document Sidebar

- [ ] Create document list component with `ScrollArea`
- [ ] Implement folder structure with `Collapsible` + `Accordion`
- [ ] Add "New Document" button with `Button` + `Dialog`
- [ ] Show recent documents section
- [ ] Add document search with `Command` palette (Cmd+K)
- [ ] Implement `ContextMenu` for right-click actions (rename, delete, duplicate)
- [ ] Add `Skeleton` loading states
- [ ] Show document cards with `Card` component for grid view toggle

#### F4: Document Header

- [ ] Editable document title with inline `Input`
- [ ] Show last edited timestamp with `Badge`
- [ ] Display active collaborators with `Avatar` stack + `Tooltip`
- [ ] Add document actions `DropdownMenu` (share, export, delete)
- [ ] Implement `Breadcrumb` for folder navigation

#### F5: Tiptap Editor Setup

- [ ] Initialize Tiptap editor with `useEditor` hook
- [ ] Configure StarterKit extensions (bold, italic, headings, lists, etc.)
- [ ] Add custom extensions: TextAlign, Underline, Strike, Code, CodeBlock
- [ ] Style editor container with `prose` classes + shadcn colors
- [ ] Implement autofocus and placeholder text
- [ ] Add `bg-card` background with proper padding

#### F6: Editor Toolbar

- [ ] Create floating/sticky toolbar with `ToggleGroup`
- [ ] Text formatting: Bold, Italic, Underline, Strike using `Toggle`
- [ ] Heading selector with `Select` component
- [ ] List buttons (bullet, numbered, checklist)
- [ ] Text alignment with `ToggleGroup`
- [ ] Link insertion with `Popover` + `Input`
- [ ] Color picker for text/highlight using `Popover`
- [ ] Code block toggle
- [ ] Add `Tooltip` for each button with `Kbd` shortcuts
- [ ] Use `Separator` to group related tools

#### F7: Real-time Collaboration UI

- [ ] Display collaborator cursors with colored indicators
- [ ] Show collaborator names on cursor hover with `Tooltip`
- [ ] Implement presence awareness (who's viewing)
- [ ] Add collaborator list in header with `Avatar` + `Badge` count
- [ ] Show "X people editing" indicator

#### F8: Document Management Dialogs

- [ ] Create document dialog with `Dialog` + `Input`
- [ ] Rename document dialog
- [ ] Delete confirmation with `AlertDialog`
- [ ] Share document dialog with collaborator management
- [ ] Export options dialog (PDF, Markdown, HTML)

#### F9: Command Palette

- [ ] Implement `Command` component for quick actions
- [ ] Add document search
- [ ] Add formatting shortcuts
- [ ] Add navigation shortcuts
- [ ] Show recent documents

#### F10: Settings & Preferences

- [ ] Theme toggle (already have `ModeToggle`)
- [ ] Editor preferences (font size, line height)
- [ ] Keyboard shortcuts reference with `Kbd`
- [ ] Account settings page

#### F11: Empty States & Loading

- [ ] Design empty state for no documents using `Empty` component
- [ ] Add `Skeleton` for document list loading
- [ ] Add `Skeleton` for editor loading
- [ ] Implement `Spinner` for save operations

#### F12: Document Tabs

- [ ] Implement multi-tab document editing with `Tabs`
- [ ] Tab overflow handling with horizontal scroll
- [ ] Close button on tabs
- [ ] Tab reordering (drag & drop)

#### F13: Offline Support (Tauri)

- [ ] Implement local document caching
- [ ] Show offline indicator with `Badge`
- [ ] Sync when back online
- [ ] Conflict resolution UI

---

### Backend Tasks (Convex)

#### B1: Schema Design - DONE

- [x] Create `documents` table:

  ```typescript
  documents: defineTable({
  	title: v.string(),
  	content: v.string(), // JSON stringified Tiptap content
  	ownerId: v.string(),
  	createdAt: v.number(),
  	updatedAt: v.number(),
  	isDeleted: v.boolean(),
  	parentFolderId: v.optional(v.id("folders")),
  })
  	.index("by_owner", ["ownerId"])
  	.index("by_folder", ["parentFolderId"])
  ```

- [x] Create `folders` table:

  ```typescript
  folders: defineTable({
  	name: v.string(),
  	ownerId: v.string(),
  	parentId: v.optional(v.id("folders")),
  	createdAt: v.number(),
  })
  	.index("by_owner", ["ownerId"])
  	.index("by_parent", ["parentId"])
  ```

- [x] Create `documentCollaborators` table:

  ```typescript
  documentCollaborators: defineTable({
  	documentId: v.id("documents"),
  	userId: v.string(),
  	role: v.union(v.literal("viewer"), v.literal("editor"), v.literal("owner")),
  	addedAt: v.number(),
  })
  	.index("by_document", ["documentId"])
  	.index("by_user", ["userId"])
  ```

- [x] Create `documentVersions` table (for history):
  ```typescript
  documentVersions: defineTable({
  	documentId: v.id("documents"),
  	content: v.string(),
  	createdAt: v.number(),
  	createdBy: v.string(),
  }).index("by_document", ["documentId"])
  ```

#### B2: Document CRUD Operations - DONE

- [x] `createDocument` mutation
- [x] `getDocument` query (with auth check)
- [x] `updateDocument` mutation (with optimistic updates)
- [x] `deleteDocument` mutation (soft delete)
- [x] `restoreDocument` mutation
- [x] `duplicateDocument` mutation
- [x] `listDocuments` query (by owner, with pagination)
- [x] `searchDocuments` query (full-text search)

#### B3: Real-time Sync - DONE

- [x] `subscribeToDocument` - real-time document content updates
- [x] `updateDocumentContent` mutation - debounced content updates
- [x] Implement operational transforms or CRDT-like conflict resolution
- [x] Add version tracking for conflict detection

#### B4: Collaboration Features - DONE

- [x] `addCollaborator` mutation
- [x] `removeCollaborator` mutation
- [x] `updateCollaboratorRole` mutation
- [x] `listCollaborators` query
- [x] `getDocumentsByCollaboration` query

#### B5: Presence & Awareness - DONE

- [x] `updatePresence` mutation (cursor position, selection)
- [x] `getActiveUsers` query (who's currently viewing)
- [x] Implement presence cleanup (remove stale presence data)
- [x] Store cursor positions and selections

#### B6: Folder Management - DONE

- [x] `createFolder` mutation
- [x] `renameFolder` mutation
- [x] `deleteFolder` mutation
- [x] `moveDocument` mutation (to different folder)
- [x] `listFolders` query
- [x] `getFolderContents` query

#### B7: Version History - DONE

- [x] `createVersion` mutation (auto-save snapshots)
- [x] `listVersions` query
- [x] `restoreVersion` mutation
- [x] Implement auto-versioning (every X minutes or on significant changes)

#### B8: Export Functions - DONE

- [x] `exportToMarkdown` action
- [x] `exportToHTML` action
- [x] `exportToJSON` action
- [x] `exportToText` action

#### B9: User Preferences - DONE

- [x] `getUserPreferences` query
- [x] `updateUserPreferences` mutation
- [x] Store: theme, editor settings, recent documents

#### B10: Analytics & Metrics - DONE

- [x] `trackDocumentView` mutation
- [x] `trackDocumentEdit` mutation
- [x] `getDocumentStats` query (view count, edit count)
- [x] `getRecentActivity` query
- [x] `getUserActivitySummary` query
- [x] `getMostActiveDocuments` query
- [x] `getActivityTimeline` query

---

## Implementation Order

### Phase 1: Foundation (Week 1)

1. **B1**: Schema design
2. **F1**: Install dependencies
3. **B2**: Basic CRUD operations
4. **F5**: Basic Tiptap editor setup
5. **F2**: App shell layout

### Phase 2: Core Features (Week 2)

6. **F3**: Document sidebar
7. **F4**: Document header
8. **F6**: Editor toolbar
9. **B6**: Folder management
10. **F8**: Document management dialogs

### Phase 3: Real-time Collaboration (Week 3)

11. **B3**: Real-time sync
12. **B5**: Presence & awareness
13. **F7**: Collaboration UI
14. **B4**: Collaboration features

### Phase 4: Polish (Week 4)

15. **F9**: Command palette
16. **F11**: Empty states & loading
17. **B7**: Version history
18. **F10**: Settings
19. **B8**: Export functions

### Phase 5: Advanced Features (Week 5)

20. **F12**: Document tabs
21. **F13**: Offline support
22. **B9**: User preferences
23. **B10**: Analytics

---

## File Structure

```
apps/web/src/
├── components/
│   ├── editor/
│   │   ├── tiptap-editor.tsx        # Main editor component
│   │   ├── editor-toolbar.tsx       # Formatting toolbar
│   │   ├── toolbar-button.tsx       # Reusable toolbar button
│   │   ├── link-popover.tsx         # Link insertion
│   │   ├── color-picker.tsx         # Text/highlight colors
│   │   └── collaborator-cursor.tsx  # Remote cursor display
│   ├── documents/
│   │   ├── document-list.tsx        # Sidebar document list
│   │   ├── document-card.tsx        # Grid view card
│   │   ├── document-item.tsx        # List view item
│   │   ├── folder-tree.tsx          # Folder structure
│   │   ├── create-dialog.tsx        # New document dialog
│   │   └── share-dialog.tsx         # Sharing dialog
│   ├── layout/
│   │   ├── app-sidebar.tsx          # Main sidebar
│   │   ├── app-header.tsx           # Top header
│   │   └── editor-layout.tsx        # Editor container
│   └── ui/                          # shadcn components (existing)
├── hooks/
│   ├── use-document.ts              # Document operations
│   ├── use-documents.ts             # Document list
│   ├── use-editor.ts                # Tiptap editor instance
│   ├── use-collaboration.ts         # Real-time sync
│   └── use-presence.ts              # User presence
├── routes/
│   ├── __root.tsx                   # Root layout
│   ├── index.tsx                    # Dashboard/home
│   ├── documents/
│   │   ├── index.tsx                # All documents
│   │   └── $documentId.tsx          # Single document editor
│   └── settings.tsx                 # User settings
└── lib/
    ├── tiptap/
    │   ├── extensions.ts            # Tiptap extensions config
    │   └── collaboration.ts         # Yjs provider setup
    └── convex.ts                    # Convex client helpers

packages/backend/convex/
├── schema.ts                        # Database schema
├── documents.ts                     # Document operations
├── folders.ts                       # Folder operations
├── collaborators.ts                 # Collaboration
├── presence.ts                      # User presence
├── versions.ts                      # Version history
└── exports.ts                       # Export actions
```

---

## Key Technical Decisions

### 1. Real-time Sync Strategy

Using Convex's built-in real-time subscriptions instead of Yjs websocket server:

- Document content stored as JSON in Convex
- `useQuery` for real-time updates
- Debounced mutations for content changes (300ms)
- Last-write-wins for conflict resolution (simpler than OT/CRDT)

### 2. Collaboration Approach

- Store document content as Tiptap JSON
- Broadcast cursor positions via Convex presence table
- Color-coded cursors per user
- Show collaborator avatars in header

### 3. Editor Extensions

```typescript
const extensions = [
	StarterKit,
	Underline,
	TextAlign.configure({ types: ["heading", "paragraph"] }),
	Highlight.configure({ multicolor: true }),
	Link.configure({ openOnClick: false }),
	Placeholder.configure({ placeholder: "Start writing..." }),
	CharacterCount,
]
```

### 4. Offline Support (Tauri)

- Use Tauri's localStorage/IndexedDB for local cache
- Queue mutations when offline
- Sync when connection restored
- Show visual indicator for sync status

---

## UI/UX Guidelines

### Colors (Dark Mode Focus)

- Use `bg-background` for main content area
- Use `bg-sidebar` for sidebar
- Use `bg-card` for document editor area
- Use `bg-accent` for hover states
- Use `text-muted-foreground` for secondary text
- Use `border-border` for all borders

### Spacing

- Consistent `p-4` padding in content areas
- `gap-2` between toolbar items
- `gap-4` between major sections

### Typography

- Geist Mono font (already configured)
- Document titles: `text-lg font-semibold`
- Body text: `text-sm`
- Muted text: `text-muted-foreground`

### Interactions

- All buttons have `hover:bg-accent` states
- Use `Tooltip` for icon-only buttons
- Add `Kbd` hints for keyboard shortcuts
- Smooth transitions with `transition-colors`

---

## Success Criteria

- [ ] User can create, edit, and delete documents
- [ ] Real-time sync works between multiple tabs/devices
- [ ] Multiple users can edit the same document simultaneously
- [ ] Cursors and selections are visible to all collaborators
- [ ] App works offline with sync when reconnected
- [ ] All UI uses shadcn components consistently
- [ ] Dark mode looks polished with proper color usage
- [ ] Editor toolbar provides all essential formatting options
- [ ] Document organization with folders works smoothly
- [ ] Search finds documents quickly
- [ ] Export to common formats works
