"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { TaskCommentWithAuthor } from "@/lib/types"
import { Pencil, RefreshCw, Send, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

/**
 * The comments slide-over, with no data access of its own.
 *
 * Each domain supplies a controller: `ProjectTaskCommentsPanel` for project
 * tasks (backed by `ProjectTasksProvider`) and `MyTaskCommentsPanel` for
 * `my-tasks` (local `useOptimistic` state until that domain gets a store).
 * Both render this, so the markup, edit-in-place state and scroll behaviour
 * exist once instead of drifting apart per domain.
 *
 * Only ephemeral form state lives here — the draft text, which comment is being
 * edited, and the scroll position. Loading, fetching and mutations belong to
 * the controller.
 */
interface TaskCommentsSheetProps {
  taskName: string
  description?: string | null
  comments: TaskCommentWithAuthor[]
  loading: boolean
  currentUserId: string
  /** Whether the viewer may delete any comment on the task. */
  canModerate: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
  onSend: (content: string) => void
  onEdit: (commentId: string, content: string) => void
  onDelete: (commentId: string) => void
}

export function TaskCommentsSheet({
  taskName,
  description,
  comments,
  loading,
  currentUserId,
  canModerate,
  open,
  onOpenChange,
  onRefresh,
  onSend,
  onEdit,
  onDelete,
}: TaskCommentsSheetProps) {
  const t = useTranslations()
  const [newComment, setNewComment] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments])

  function handleSend() {
    const content = newComment.trim()
    if (!content) return
    setNewComment("")
    onSend(content)
  }

  function handleEditStart(comment: TaskCommentWithAuthor) {
    setEditingId(comment.id)
    setEditContent(comment.content)
  }

  function handleEditCancel() {
    setEditingId(null)
    setEditContent("")
  }

  function handleEditSave() {
    if (!editingId || !editContent.trim()) return
    const content = editContent.trim()
    setEditingId(null)
    setEditContent("")
    onEdit(editingId, content)
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-base">{taskName}</SheetTitle>
          {description && (
            <SheetDescription>{description}</SheetDescription>
          )}
        </SheetHeader>

        <div className="flex items-center justify-between px-4 pt-2">
          <span className="text-sm font-medium">
            {t("projects.tasks.comments.title")}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3"
        >
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("projects.tasks.comments.noComments")}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {comments.map((comment) => (
                <div key={comment.id} className="group flex gap-3">
                  <Avatar size="sm">
                    <AvatarImage
                      src={comment.authorImage ?? undefined}
                    />
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
                        {formatRelativeTime(
                          new Date(comment.createdAt)
                        )}
                        {comment.updatedAt > comment.createdAt && (
                          <> ({t("projects.tasks.comments.edited")})</>
                        )}
                      </span>
                    </div>
                    {editingId === comment.id ? (
                      <div className="mt-1 flex flex-col gap-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) =>
                            setEditContent(e.target.value)
                          }
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
                  {comment.authorId === currentUserId &&
                    editingId !== comment.id && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={() => handleEditStart(comment)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  {(comment.authorId === currentUserId ||
                    canModerate) &&
                    editingId !== comment.id && (
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
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3">
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={t("projects.tasks.comments.addComment")}
              rows={2}
              className="resize-none"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!newComment.trim()}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
