import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserPlus, Trash2, Crown, Users } from "lucide-react"
import { toast } from "sonner"

type DocumentId = GenericId<"documents">
type Role = "viewer" | "editor" | "owner"

interface ShareDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: DocumentId
  documentTitle: string
}

export function ShareDocumentDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle,
}: ShareDocumentDialogProps) {
  const [userId, setUserId] = useState("")
  const [role, setRole] = useState<Role>("editor")
  const [isAdding, setIsAdding] = useState(false)

  const collaborators = useQuery(api.collaborators.listCollaborators, { documentId })
  const access = useQuery(api.collaborators.checkAccess, { documentId })
  const addCollaborator = useMutation(api.collaborators.addCollaborator)
  const removeCollaborator = useMutation(api.collaborators.removeCollaborator)
  const updateRole = useMutation(api.collaborators.updateCollaboratorRole)

  const isOwner = access?.hasAccess && access.isOwner

  const handleAddCollaborator = async () => {
    const trimmedUserId = userId.trim()
    if (!trimmedUserId) return

    setIsAdding(true)
    try {
      await addCollaborator({
        documentId,
        userId: trimmedUserId,
        role,
      })
      setUserId("")
      toast.success("Collaborator added")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add collaborator")
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveCollaborator = async (collaboratorUserId: string) => {
    try {
      await removeCollaborator({
        documentId,
        userId: collaboratorUserId,
      })
      toast.success("Collaborator removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove collaborator")
    }
  }

  const handleUpdateRole = async (collaboratorUserId: string, newRole: Role) => {
    try {
      await updateRole({
        documentId,
        userId: collaboratorUserId,
        newRole,
      })
      toast.success("Role updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isAdding && userId.trim()) {
      handleAddCollaborator()
    }
  }

  const getInitials = (userId: string) => {
    return userId.slice(0, 2).toUpperCase()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share Document
          </DialogTitle>
          <DialogDescription>
            Share "{documentTitle}" with others by adding collaborators.
          </DialogDescription>
        </DialogHeader>

        {/* Add Collaborator Form - Only shown to owner */}
        {isOwner && (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="userId">User ID</Label>
              <div className="flex gap-2">
                <Input
                  id="userId"
                  placeholder="Enter user ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleAddCollaborator}
              disabled={isAdding || !userId.trim()}
              className="w-full gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {isAdding ? "Adding..." : "Add Collaborator"}
            </Button>
          </div>
        )}

        {isOwner && <Separator />}

        {/* Collaborators List */}
        <div className="space-y-2">
          <Label>Collaborators</Label>
          <ScrollArea className="h-48">
            {!collaborators || collaborators.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                {isOwner
                  ? "No collaborators yet. Add someone to start collaborating!"
                  : "No other collaborators on this document."}
              </div>
            ) : (
              <div className="space-y-2 pr-3">
                {collaborators.map((collab) => (
                  <div
                    key={collab._id}
                    className="bg-muted/50 flex items-center gap-3 overflow-hidden rounded-lg p-3"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs">
                        {getInitials(collab.userId)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="max-w-[160px] truncate text-sm font-medium">{collab.userId}</p>
                      <p className="text-muted-foreground text-xs">
                        Added {new Date(collab.addedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {collab.role === "owner" ? (
                        <Badge variant="secondary" className="gap-1">
                          <Crown className="h-3 w-3" />
                          Owner
                        </Badge>
                      ) : isOwner ? (
                        <Select
                          value={collab.role}
                          onValueChange={(v) => handleUpdateRole(collab.userId, v as Role)}
                        >
                          <SelectTrigger className="h-8 w-24 p-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">
                          {collab.role.charAt(0).toUpperCase() + collab.role.slice(1)}
                        </Badge>
                      )}
                      {collab.role !== "owner" && isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-8 w-8"
                          onClick={() => handleRemoveCollaborator(collab.userId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
