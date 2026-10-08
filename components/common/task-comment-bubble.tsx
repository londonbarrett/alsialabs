"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { TaskCommentWithAuthor } from "@/lib/types"
import { Pencil, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

/**
 * One comment row in the task comments panel: author, relative time, content
 * and the edit/delete affordances. Owns its ephemeral edit-in-place state —
 * which draft text is being edited belongs to the row, not the panel.
 */
interface TaskCommentBubbleProps {
  comment: TaskCommentWithAuthor
  currentUserId: string
  /** Whether the viewer may delete any comment on the task. */
  canModerate: boolean
  onEdit: (commentId: string, content: string) => void
  onDelete: (commentId: string) => void
}

export function TaskCommentBubble({
  comment,
  currentUserId,
  canModerate,
  onEdit,
  onDelete,
}: TaskCommentBubbleProps) {
  const t = useTranslations()
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState("")

  function handleEditStart() {
    setEditContent(comment.content)
    setEditing(true)
  }

  function handleEditCancel() {
    setEditing(false)
    setEditContent("")
  }

  function handleEditSave() {
    if (!editContent.trim()) return
    const content = editContent.trim()
    setEditing(false)
    setEditContent("")
    onEdit(comment.id, content)
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleEditSave()
    }
    if (e.key === "Escape") {
      handleEditCancel()
    }
  }

  return (
    <div className="group flex gap-3">
      <Avatar size="sm">
        <AvatarImage src={comment.authorImage ?? undefined} />
        <AvatarFallback>
          {getInitials(comment.authorName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">
            {comment.authorName || t("auth.user")}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(new Date(comment.createdAt))}
            {comment.updatedAt > comment.createdAt && (
              <> ({t("projects.tasks.comments.edited")})</>
            )}
          </span>
        </div>
        {editing ? (
          <div className="mt-1 flex flex-col gap-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={2}
              className="resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                onClick={handleEditSave}
                disabled={!editContent.trim()}
              >
                {t("common.save")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleEditCancel}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm wrap-break-word whitespace-pre-wrap">
            {comment.content}
          </p>
        )}
      </div>
      {comment.authorId === currentUserId && !editing && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 opacity-0 group-hover:opacity-100"
          onClick={handleEditStart}
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      )}
      {(comment.authorId === currentUserId || canModerate) &&
        !editing && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 opacity-0 group-hover:opacity-100"
            onClick={() => onDelete(comment.id)}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
    </div>
  )
}

function getInitials(name: string | null) {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatRelativeTime(date: Date) {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}
